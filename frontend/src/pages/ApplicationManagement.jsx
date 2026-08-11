import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Calendar, FileSpreadsheet, UploadCloud, CheckCircle, AlertTriangle, Download, List, FileCheck, Info, Loader2, BarChart2, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';
import { saveAs } from 'file-saver';
import { ORGANIZATION_NAME } from '../constants';

export const ApplicationManagement = () => {
  const navigate = useNavigate();
  
  const [activities, setActivities] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]);
  const [systemSettings, setSystemSettings] = useState({ paymentDates: [] });
  const [loading, setLoading] = useState(true);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');

  const [selectedPayment, setSelectedPayment] = useState("");
  const [mismatches, setMismatches] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [importedWorkbook, setImportedWorkbook] = useState(null);
  const [analysisDone, setAnalysisDone] = useState(false);

  const [selectedActivityIds, setSelectedActivityIds] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const unsubActivities = onSnapshot(collection(db, 'activities'), (s) => setActivities(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMembers = onSnapshot(collection(db, 'members'), (s) => setMembersList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMachines = onSnapshot(collection(db, 'machines'), (s) => setMachinesList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), (s) => setSystemUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) setSystemSettings(docSnap.data());
      setLoading(false);
    });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role || 'reporter');
          } else {
            setUserRole('reporter');
          }
        } catch (e) {
          console.error(e);
          setUserRole('reporter');
        }
      } else {
        setUserRole('reporter');
      }
    });

    return () => { unsubActivities(); unsubMembers(); unsubMachines(); unsubUsers(); unsubSettings(); unsubAuth(); };
  }, []);

  useEffect(() => {
    if (isPrinting) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);

      const handleAfterPrint = () => {
        setIsPrinting(false); 
      };

      window.addEventListener('afterprint', handleAfterPrint);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('afterprint', handleAfterPrint);
      };
    }
  }, [isPrinting]);

  const paymentOptions = useMemo(() => {
    const opts = new Map();
    (systemSettings.paymentDates || []).forEach(p => {
        opts.set(p.id, { type: 'system', label: `${p.label} ${p.date ? `(${p.date})` : ''}`, value: p.id });
    });

    activities.forEach(a => {
        if (a.status !== '未実施' && a.paymentDateId === 'custom' && a.customPaymentDate) {
            const val = `custom_${a.customPaymentDate}`;
            if (!opts.has(val)) {
                opts.set(val, { type: 'custom', label: `任意指定: ${a.customPaymentDate}`, value: val });
            }
        }
    });

    return Array.from(opts.values());
  }, [activities, systemSettings]);

  const selectedPaymentLabel = useMemo(() => {
    return paymentOptions.find(o => o.value === selectedPayment)?.label || "未設定";
  }, [selectedPayment, paymentOptions]);

  const filteredActivities = useMemo(() => {
    if (!selectedPayment) return [];
    const isCustom = selectedPayment.startsWith('custom_');
    const actualValue = isCustom ? selectedPayment.replace('custom_', '') : selectedPayment;

    return activities.filter(a => {
        if (a.status === '未実施') return false;
        if (isCustom) {
            return a.paymentDateId === 'custom' && a.customPaymentDate === actualValue;
        } else {
            return a.paymentDateId === actualValue;
        }
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [activities, selectedPayment]);

  const calculateCost = (act) => {
    let pCost = 0; let mCost = 0;
    (act.participantDetails || []).forEach(detail => {
      const wId = detail.wageId || detail.memberId;
      if (wId) {
        const wage = membersList.find(m => m.id === wId);
        if (wage) pCost += (detail.workTime || 0) * (wage.defaultWage || 0);
      }
      if (detail.machineId) {
        const machine = machinesList.find(m => m.id === detail.machineId);
        if (machine) mCost += (detail.machineTime || 0) * (machine.defaultPrice || 0);
      }
    });
    return { pCost, mCost, total: pCost + mCost };
  };

  const displayUserName = useMemo(() => {
    if (!currentUser) return 'ユーザー';
    const matchedUser = systemUsers.find(u => u.id === currentUser.uid);
    return matchedUser?.name || matchedUser?.displayName || currentUser.displayName || 'ユーザー';
  }, [currentUser, systemUsers]);

  const normalizedDisplayUserName = useMemo(() => {
    return displayUserName.replace(/[\s ]/g, '');
  }, [displayUserName]);

  const pdfPersonSummaries = useMemo(() => {
    const summary = {};
    const selectedActs = filteredActivities.filter(a => selectedActivityIds.includes(a.id));

    selectedActs.forEach(act => {
      (act.participantDetails || []).forEach(detail => {
        const wId = detail.wageId || detail.memberId;
        const wage = membersList.find(m => m.id === wId);
        const memberWage = wage ? (wage.defaultWage || 0) : 0;
        const memberTotal = (detail.workTime || 0) * memberWage;

        const machine = machinesList.find(m => m.id === detail.machineId);
        const machinePrice = machine ? (machine.defaultPrice || 0) : 0;
        const machineTotal = (detail.machineTime || 0) * machinePrice;

        const personName = detail.participantName || wage?.name || '名称未設定';
        const normName = personName.replace(/[\s ]/g, '');

        if (!summary[normName]) {
          summary[normName] = {
            name: personName,
            normName: normName,
            wageTotal: 0,
            machineTotal: 0,
            grandTotal: 0,
            details: []
          };
        }

        if (memberTotal > 0 || machineTotal > 0) {
          summary[normName].wageTotal += memberTotal;
          summary[normName].machineTotal += machineTotal;
          summary[normName].grandTotal += (memberTotal + machineTotal);
          summary[normName].details.push({
            date: act.date,
            activityName: act.activityType,
            wage: memberTotal,
            machine: machineTotal,
            total: memberTotal + machineTotal
          });
        }
      });
    });

    const allSummaries = Object.values(summary).sort((a, b) => b.grandTotal - a.grandTotal);

    if (userRole === 'admin' || userRole === 'manager') {
      return allSummaries; 
    }
    return allSummaries.filter(p => p.normName === normalizedDisplayUserName);
  }, [filteredActivities, selectedActivityIds, membersList, machinesList, userRole, normalizedDisplayUserName]);

  const annualSummary = useMemo(() => {
    const categories = [
      { id: 'agriMaintain', name: '１ 農地維持支払' },
      { id: 'resourceJoint', name: '２ 資源向上支払（共同）' },
      { id: 'resourceLongLife', name: '３ 資源向上支払（長寿命化）' },
      { id: 'unassigned', name: '未設定 / その他' }
    ];

    const periods = (systemSettings.paymentDates || []).map(p => ({
      id: p.id, label: p.label, total: 0
    }));

    const customPeriodsMap = new Map();
    activities.forEach(a => {
      if (a.status !== '未実施' && a.paymentDateId === 'custom' && a.customPaymentDate) {
        customPeriodsMap.set(`custom_${a.customPaymentDate}`, `任意: ${a.customPaymentDate}`);
      }
    });
    customPeriodsMap.forEach((label, id) => {
      periods.push({ id, label, total: 0 });
    });

    periods.push({ id: 'unassigned_period', label: '時期未設定', total: 0 });

    const matrix = {};
    categories.forEach(c => {
      matrix[c.id] = { name: c.name, rowTotal: 0 };
      periods.forEach(p => { matrix[c.id][p.id] = 0; });
    });

    let grandTotal = 0;

    activities.forEach(act => {
      if (act.status === '未実施') return;

      const cost = calculateCost(act);
      const totalCost = cost.total;

      const category = act.paymentCategory || '';
      let catKey = 'unassigned';
      if (category.includes('1') || category.includes('１')) catKey = 'agriMaintain';
      else if (category.includes('2') || category.includes('２')) catKey = 'resourceJoint';
      else if (category.includes('3') || category.includes('３')) catKey = 'resourceLongLife';

      let periodKey = 'unassigned_period';
      if (act.paymentDateId === 'custom' && act.customPaymentDate) {
        periodKey = `custom_${act.customPaymentDate}`;
      } else if (act.paymentDateId) {
        if (periods.some(p => p.id === act.paymentDateId)) periodKey = act.paymentDateId;
      }

      matrix[catKey][periodKey] += totalCost;
      matrix[catKey].rowTotal += totalCost;
      
      const periodObj = periods.find(p => p.id === periodKey);
      if (periodObj) periodObj.total += totalCost;

      grandTotal += totalCost;
    });

    const visiblePeriods = periods.filter(p => (!p.id.startsWith('custom_') && p.id !== 'unassigned_period') || p.total > 0);

    return { categories, periods: visiblePeriods, matrix, grandTotal };
  }, [activities, systemSettings, membersList, machinesList]);

  const totals = useMemo(() => {
    let pCostTotal = 0; let mCostTotal = 0;
    filteredActivities.forEach(act => {
      const cost = calculateCost(act);
      pCostTotal += cost.pCost;
      mCostTotal += cost.mCost;
    });
    return { pCost: pCostTotal, mCost: mCostTotal, total: pCostTotal + mCostTotal };
  }, [filteredActivities, membersList, machinesList]);

  const categoryTotals = useMemo(() => {
    const totalsMap = {
      agriMaintain: { name: '１ 農地維持支払', pCost: 0, mCost: 0, total: 0 },
      resourceJoint: { name: '２ 資源向上支払（共同）', pCost: 0, mCost: 0, total: 0 },
      resourceLongLife: { name: '３ 資源向上支払（長寿命化）', pCost: 0, mCost: 0, total: 0 },
      unassigned: { name: '未設定 / その他', pCost: 0, mCost: 0, total: 0 }
    };

    filteredActivities.forEach(act => {
      const cost = calculateCost(act);
      const category = act.paymentCategory || '';

      let targetKey = 'unassigned';
      if (category.includes('1') || category.includes('１')) targetKey = 'agriMaintain';
      else if (category.includes('2') || category.includes('２')) targetKey = 'resourceJoint';
      else if (category.includes('3') || category.includes('３')) targetKey = 'resourceLongLife';

      totalsMap[targetKey].pCost += cost.pCost;
      totalsMap[targetKey].mCost += cost.mCost;
      totalsMap[targetKey].total += cost.total;
    });

    return Object.values(totalsMap).filter(cat => cat.name !== '未設定 / その他' || cat.total > 0);
  }, [filteredActivities, membersList, machinesList]);

  const getVal = (sheet, r, c) => {
      const val = sheet.cell(r, c).value();
      if (typeof val === 'number') return val;
      if (typeof val === 'string') {
          const num = Number(val.replace(/[^\d.-]/g, ''));
          return isNaN(num) ? 0 : num;
      }
      return 0; 
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsAnalyzing(true);
    setMismatches([]);
    setAnalysisDone(false);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
      setImportedWorkbook(workbook);

      const sheet = workbook.sheet('日当整理表（複合）') || workbook.sheets()[0];
      
      const cols = [];
      for (let c = 4; c <= 100; c++) {
        const headerVal = sheet.cell(4, c).value();
        if (headerVal === '小 計') break;
        
        const actVal = sheet.cell(10, c).value();
        if (actVal && typeof actVal === 'string') {
          const match = actVal.match(/NO\.(\d+)/);
          if (match) {
            cols.push({
              colIndex: c,
              reportNo: match[1],
              activityName: actVal.replace(/NO\.\d+ /, '')
            });
          }
        }
      }

      const excelPersons = [];
      let r = 11;
      while (r < 500) {
        const cellA = sheet.cell(r, 1).value();
        const cellB = sheet.cell(r, 2).value();
        if (cellA === '合 計' || cellA === '小 計' || String(cellA).includes('計')) break;
        
        if (cellB && typeof cellB === 'string') {
            excelPersons.push({
                name: cellB,
                normName: cellB.replace(/[\s ]/g, ''),
                wageRowIdx: r,
                machineRowIdx1: r + 1,
                machineRowIdx2: r + 2
            });
            r += 3;
        } else {
            r++;
        }
      }

      const newMismatches = [];

      cols.forEach(colInfo => {
          const act = filteredActivities.find(a => a.reportNo === colInfo.reportNo);
          if (!act) {
              const actAny = activities.find(a => a.reportNo === colInfo.reportNo);
              if (actAny) {
                  newMismatches.push({
                      type: '対象外活動',
                      message: `NO.${colInfo.reportNo} は現在選択されている申請時期とは異なる設定になっています。`,
                      colIdx: colInfo.colIndex
                  });
              } else {
                  newMismatches.push({
                      type: '活動未登録',
                      message: `NO.${colInfo.reportNo} の活動がシステム内に見つかりません。`,
                      colIdx: colInfo.colIndex
                  });
              }
              return;
          }

          const sysTotalsByPerson = {}; 
          (act.participantDetails || []).forEach(detail => {
              const wId = detail.wageId || detail.memberId;
              const wage = membersList.find(m => m.id === wId);
              const memberWage = wage ? (wage.defaultWage || 0) : 0;
              const memberTotal = (detail.workTime || 0) * memberWage;

              const machine = machinesList.find(m => m.id === detail.machineId);
              const machinePrice = machine ? (machine.defaultPrice || 0) : 0;
              const machineTotal = (detail.machineTime || 0) * machinePrice;

              const personName = detail.participantName || wage?.name || '名称未設定';
              const normName = personName.replace(/[\s ]/g, '');

              if (!sysTotalsByPerson[normName]) {
                  sysTotalsByPerson[normName] = { wage: 0, machine: 0 };
              }
              sysTotalsByPerson[normName].wage += memberTotal;
              sysTotalsByPerson[normName].machine += machineTotal;
          });

          excelPersons.forEach(ep => {
              const exWage = getVal(sheet, ep.wageRowIdx, colInfo.colIndex);
              const exMachine1 = getVal(sheet, ep.machineRowIdx1, colInfo.colIndex);
              const exMachine2 = getVal(sheet, ep.machineRowIdx2, colInfo.colIndex);
              const exMachineTotal = exMachine1 + exMachine2;

              const sysData = sysTotalsByPerson[ep.normName] || { wage: 0, machine: 0 };

              if (exWage !== sysData.wage) {
                  newMismatches.push({
                      type: '日当金額',
                      personName: ep.name,
                      activityName: colInfo.activityName,
                      reportNo: colInfo.reportNo,
                      sysVal: sysData.wage,
                      exVal: exWage,
                      rowIdx: ep.wageRowIdx,
                      colIdx: colInfo.colIndex
                  });
              }

              if (exMachineTotal !== sysData.machine) {
                  newMismatches.push({
                      type: '機械利用料',
                      personName: ep.name,
                      activityName: colInfo.activityName,
                      reportNo: colInfo.reportNo,
                      sysVal: sysData.machine,
                      exVal: exMachineTotal,
                      rowIdx: exMachineTotal === 0 ? ep.machineRowIdx1 : (exMachine1 !== 0 ? ep.machineRowIdx1 : ep.machineRowIdx2),
                      rowIdx2: exMachineTotal === 0 ? ep.machineRowIdx2 : null,
                      colIdx: colInfo.colIndex
                  });
              }

              delete sysTotalsByPerson[ep.normName];
          });

          Object.keys(sysTotalsByPerson).forEach(normName => {
              const sysData = sysTotalsByPerson[normName];
              if (sysData.wage > 0 || sysData.machine > 0) {
                  newMismatches.push({
                      type: 'システムのみ登録',
                      personName: normName,
                      reportNo: colInfo.reportNo,
                      activityName: colInfo.activityName,
                      message: `${normName}さんの実績(日当¥${sysData.wage}/機械¥${sysData.machine})がシステムにはありますがExcel側にはありません。`,
                      colIdx: colInfo.colIndex
                  });
              }
          });
      });

      setMismatches(newMismatches);
      setAnalysisDone(true);
    } catch (err) {
      console.error(err);
      alert('ファイルの解析に失敗しました。フォーマットが正しいか確認してください。');
    } finally {
      setIsAnalyzing(false);
      e.target.value = '';
    }
  };

  const handleDownloadDiff = async () => {
    if (!importedWorkbook) return;
    
    const sheet = importedWorkbook.sheet('日当整理表（複合）') || importedWorkbook.sheets()[0];
    mismatches.forEach(m => {
        if (m.rowIdx && m.colIdx) sheet.cell(m.rowIdx, m.colIdx).style("fill", "ffcccc"); 
        if (m.rowIdx2 && m.colIdx) sheet.cell(m.rowIdx2, m.colIdx).style("fill", "ffcccc");
        if ((m.type === '対象外活動' || m.type === '活動未登録') && m.colIdx) sheet.cell(10, m.colIdx).style("fill", "ffcccc");
    });

    const blob = await importedWorkbook.outputAsync();
    saveAs(blob, `差分ハイライト_${Date.now()}.xlsx`);
  };

  const handleSelectAllActivities = (e) => {
    if (e.target.checked) {
        setSelectedActivityIds(filteredActivities.map(a => a.id));
    } else {
        setSelectedActivityIds([]);
    }
  };

  const toggleActivitySelect = (id) => {
    setSelectedActivityIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleGenerateReceipts = () => {
    if (pdfPersonSummaries.length === 0) return;
    setIsPrinting(true);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-blue-500" /></div>;
  }

  return (
    <>
      <div style={{ display: isPrinting ? 'none' : 'block' }}>
        <div className="min-h-screen bg-gray-50 pb-20">
          <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
                <ArrowLeft size={24} />
              </button>
              <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
                <FileCheck className="w-6 h-6 mr-2 text-blue-600" />
                申請管理・照合
              </h1>
            </div>
          </header>

          <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">

            {(userRole === 'admin' || userRole === 'manager') && (
              <>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
                  <div className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex justify-between items-center">
                    <h2 className="font-bold text-indigo-900 flex items-center">
                      <BarChart2 className="mr-2 text-indigo-600" /> 年間申請サマリー（申請時期 × 支払区分）
                    </h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3 border-r border-gray-100">支払区分</th>
                          {annualSummary.periods.map(p => (
                            <th key={p.id} className="p-3 text-right">{p.label}</th>
                          ))}
                          <th className="p-3 text-right border-l border-gray-200 text-indigo-800">年間合計</th>
                        </tr>
                      </thead>
                      <tbody>
                        {annualSummary.categories.map((cat) => (
                          <tr key={cat.id} className="border-b border-gray-50 hover:bg-indigo-50/50 transition-colors">
                            <td className="p-3 font-bold text-gray-700 border-r border-gray-100">{cat.name}</td>
                            {annualSummary.periods.map(p => (
                              <td key={p.id} className="p-3 text-right font-mono text-gray-600">
                                ¥{annualSummary.matrix[cat.id][p.id].toLocaleString()}
                              </td>
                            ))}
                            <td className="p-3 text-right font-mono font-bold text-indigo-700 border-l border-gray-200 bg-indigo-50/30">
                              ¥{annualSummary.matrix[cat.id].rowTotal.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-indigo-50 border-t-2 border-indigo-200 font-bold">
                          <td className="p-3 text-center text-indigo-900 border-r border-indigo-100">時期別合計</td>
                          {annualSummary.periods.map(p => (
                            <td key={p.id} className="p-3 text-right font-mono text-indigo-800">
                              ¥{p.total.toLocaleString()}
                            </td>
                          ))}
                          <td className="p-3 text-right font-mono text-indigo-900 text-lg border-l border-indigo-200 bg-indigo-100/50">
                            ¥{annualSummary.grandTotal.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                  <h2 className="font-bold text-gray-800 mb-4 flex items-center"><Calendar className="mr-2 text-blue-600"/> 振込日（申請時期）で絞り込み</h2>
                  <select 
                    value={selectedPayment} 
                    onChange={e => {
                        setSelectedPayment(e.target.value);
                        setAnalysisDone(false);
                        setMismatches([]);
                        setImportedWorkbook(null);
                        setSelectedActivityIds([]); 
                    }} 
                    className="w-full md:w-1/2 box-border border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                  >
                    <option value="">▼ 申請時期を選択してください</option>
                    {paymentOptions.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {(userRole !== 'admin' && userRole !== 'manager') && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="font-bold text-gray-800 mb-4 flex items-center"><Calendar className="mr-2 text-blue-600"/> 振込日（申請時期）を選択</h2>
                <select 
                  value={selectedPayment} 
                  onChange={e => {
                      setSelectedPayment(e.target.value);
                      setSelectedActivityIds([]); 
                  }} 
                  className="w-full md:w-1/2 box-border border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                >
                  <option value="">▼ 申請時期を選択してください</option>
                  {paymentOptions.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedPayment && (
              <>
                {(userRole === 'admin' || userRole === 'manager') && (
                  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-4 gap-3">
                      <h2 className="font-bold text-gray-800 flex items-center"><FileSpreadsheet className="mr-2 text-green-600"/> 事務局の整理表（Excel）と照合</h2>
                      {analysisDone && mismatches.length > 0 && (
                          <button onClick={handleDownloadDiff} className="bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-xl font-bold flex items-center shadow-sm hover:bg-red-100 transition-colors active:scale-95">
                            <Download size={18} className="mr-2"/> 差分ハイライト版Excelを出力
                          </button>
                      )}
                    </div>
                    
                    {!analysisDone ? (
                      <label className={`w-full py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${isAnalyzing ? 'bg-gray-50 border-gray-300' : 'bg-green-50 border-green-300 hover:bg-green-100'}`}>
                        {isAnalyzing ? (
                            <Loader2 className="w-10 h-10 text-green-500 animate-spin mb-3" />
                        ) : (
                            <UploadCloud className="w-10 h-10 text-green-500 mb-3" />
                        )}
                        <span className="font-bold text-green-800">{isAnalyzing ? 'ファイル解析中...' : '事務局のExcelをアップロードして照合'}</span>
                        <span className="text-xs text-green-600 mt-2">130_鎌田_日当等整理表（複合）.xlsx など</span>
                        <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" disabled={isAnalyzing} />
                      </label>
                    ) : (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                        {mismatches.length === 0 ? (
                            <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl font-bold flex items-center shadow-sm">
                              <CheckCircle className="mr-3 w-6 h-6"/> 差分はありません。システムとExcelの金額は完全に一致しています！
                            </div>
                        ) : (
                            <div className="p-5 bg-red-50 border border-red-100 rounded-xl shadow-sm">
                              <h3 className="font-bold text-red-800 mb-4 flex items-center text-lg"><AlertTriangle className="mr-2"/> {mismatches.length} 件の差異が見つかりました</h3>
                              <ul className="space-y-3">
                                {mismatches.map((m, i) => (
                                    <li key={i} className="text-sm bg-white p-4 rounded-xl shadow-sm border border-red-100 flex flex-col">
                                      <span className="font-extrabold text-gray-900 border-b border-gray-100 pb-2 mb-2">NO.{m.reportNo} {m.activityName}</span>
                                      {m.message ? (
                                        <span className="text-red-600 font-bold">{m.message}</span>
                                      ) : (
                                        <div className="text-gray-700 flex flex-wrap items-center gap-2">
                                            <span className="font-bold mr-2">{m.personName} さんの「{m.type}」</span> 
                                            <div className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-lg">
                                              <span className="text-xs font-bold text-gray-500">システム登録:</span>
                                              <span className="font-mono font-bold">¥{m.sysVal.toLocaleString()}</span>
                                            </div>
                                            <span className="text-gray-400 font-bold mx-1">≠</span>
                                            <div className="flex items-center gap-1 bg-red-100 px-3 py-1 rounded-lg">
                                              <span className="text-xs font-bold text-red-600">事務局Excel:</span>
                                              <span className="font-mono font-bold text-red-700">¥{m.exVal.toLocaleString()}</span>
                                            </div>
                                        </div>
                                      )}
                                    </li>
                                ))}
                              </ul>
                            </div>
                        )}
                        <div className="flex justify-center mt-4">
                            <button onClick={() => { setAnalysisDone(false); setMismatches([]); setImportedWorkbook(null); }} className="text-sm text-blue-600 border border-blue-200 bg-blue-50 px-6 py-2.5 rounded-xl font-bold hover:bg-blue-100 transition-colors">
                              別のファイルでもう一度照合する
                            </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-3">
                    <h2 className="font-bold text-gray-800 flex items-center"><List className="mr-2 text-purple-600"/> 申請対象の活動一覧 ({filteredActivities.length}件)</h2>
                    {selectedActivityIds.length > 0 && pdfPersonSummaries.length > 0 && (
                      <button 
                        onClick={handleGenerateReceipts} 
                        className="bg-green-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center hover:bg-green-700 transition-colors shadow-sm active:scale-95"
                      >
                        <Printer size={16} className="mr-2" />
                        選択した活動の支払明細書をPDF出力
                      </button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-gray-100 text-gray-600 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3 text-center w-12">
                            <input 
                              type="checkbox" 
                              checked={filteredActivities.length > 0 && selectedActivityIds.length === filteredActivities.length}
                              onChange={handleSelectAllActivities}
                              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" 
                            />
                          </th>
                          <th className="p-3 text-center w-12">No.</th>
                          <th className="p-3">日付</th>
                          <th className="p-3">時間帯</th>
                          <th className="p-3">活動内容</th>
                          <th className="p-3">報告書NO</th>
                          <th className="p-3 text-right">日当合計</th>
                          <th className="p-3 text-right">機械利用料計</th>
                          <th className="p-3 text-right text-blue-800">合計金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredActivities.length === 0 ? (
                            <tr><td colSpan="9" className="p-6 text-center text-gray-400 font-bold">この申請時期に該当する活動はありません</td></tr>
                        ) : (
                            <>
                                {filteredActivities.map((act, index) => {
                                    const cost = calculateCost(act);
                                    const isChecked = selectedActivityIds.includes(act.id);
                                    return (
                                        <tr key={act.id} className={`border-b border-gray-50 hover:bg-green-50 transition-colors cursor-pointer ${isChecked ? 'bg-[#ebf7ee]' : ''}`} onClick={() => navigate(`/activity-form/${act.id}`, { state: { isViewMode: true }})}>
                                            <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                              <input 
                                                type="checkbox" 
                                                checked={isChecked}
                                                onChange={() => toggleActivitySelect(act.id)}
                                                className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500 cursor-pointer" 
                                              />
                                            </td>
                                            <td className="p-3 text-center text-gray-500 font-mono">{index + 1}</td>
                                            <td className="p-3">{act.date}</td>
                                            <td className="p-3 font-mono">{act.startTime}〜{act.endTime}</td>
                                            <td className="p-3 font-bold text-gray-800 truncate max-w-[200px]" title={act.activityType}>{act.activityType}</td>
                                            <td className="p-3 font-bold text-blue-600">{act.reportNo}</td>
                                            <td className="p-3 text-right font-mono text-gray-600">¥{cost.pCost.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono text-gray-600">¥{cost.mCost.toLocaleString()}</td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-800">¥{cost.total.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}

                                {categoryTotals.map((cat, idx) => (
                                    <tr key={`cat-${idx}`} className="bg-gray-50 border-t border-gray-200">
                                        <td className="p-3 text-right font-bold text-gray-600" colSpan="6">【小計】 {cat.name}</td>
                                        <td className="p-3 text-right font-mono text-gray-600">¥{cat.pCost.toLocaleString()}</td>
                                        <td className="p-3 text-right font-mono text-gray-600">¥{cat.mCost.toLocaleString()}</td>
                                        <td className="p-3 text-right font-mono font-bold text-gray-700">¥{cat.total.toLocaleString()}</td>
                                    </tr>
                                ))}

                                <tr className="bg-blue-50/50 border-t-2 border-blue-200 font-bold">
                                    <td className="p-3 text-center text-blue-800" colSpan="6">総合計</td>
                                    <td className="p-3 text-right font-mono text-blue-800">¥{totals.pCost.toLocaleString()}</td>
                                    <td className="p-3 text-right font-mono text-blue-800">¥{totals.mCost.toLocaleString()}</td>
                                    <td className="p-3 text-right font-mono text-blue-900 text-lg">¥{totals.total.toLocaleString()}</td>
                                </tr>
                            </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </>
            )}
          </main>
        </div>
      </div>

      {/* 🚀 印刷モード用の画面 */}
      {isPrinting && (
        <div className="bg-white min-h-screen w-full relative z-[9999]">
          
          {/* 🚀 印刷時のみ適用されるCSS設定：ここでブラウザ標準の余白を消去し、白紙ページを防ぐ */}
          <style>
            {`
              @media print {
                @page { 
                  margin: 0; 
                  size: A4 portrait; 
                }
                body { 
                  background: white; 
                  margin: 0; 
                  padding: 0; 
                }
                .no-print { 
                  display: none !important; 
                }
                .print-page { 
                  margin: 0 !important; 
                  box-shadow: none !important; 
                  border: none !important;
                  padding: 15mm 20mm !important; /* 印刷時の余白をここで指定 */
                  page-break-after: always;
                  page-break-inside: avoid;
                }
                .print-page:last-child {
                  page-break-after: auto; /* 最後のページの後には改ページを入れない（白紙防止） */
                }
              }
            `}
          </style>
          
          <div className="no-print p-4 bg-blue-50 border-b border-blue-200 flex justify-between items-center sticky top-0 shadow-sm">
            <div>
              <p className="font-bold text-blue-800 mb-1">🖨️ 印刷ダイアログが表示されない場合は、キーボードの「Ctrl + P」（Macは「Cmd + P」）を押してください。</p>
              <p className="text-sm text-blue-600">送信先（プリンター）を「PDFに保存」に設定すると、綺麗なPDFとして保存できます。</p>
            </div>
            <button 
              onClick={() => setIsPrinting(false)} 
              className="bg-white border border-blue-300 text-blue-600 px-6 py-2 rounded-xl font-bold hover:bg-blue-100 shadow-sm transition-colors"
            >
              元の画面に戻る
            </button>
          </div>
          
          <div style={{ backgroundColor: '#f3f4f6', padding: '20px 0' }} className="print:bg-white print:p-0">
            {pdfPersonSummaries.map((person) => (
              <div 
                key={person.normName} 
                className="print-page"
                style={{ 
                  width: '100%', 
                  maxWidth: '210mm',
                  margin: '0 auto 20px auto', 
                  padding: '20mm', 
                  backgroundColor: 'white', 
                  color: 'black', 
                  fontFamily: '"Noto Serif JP", "Mincho", serif', 
                  boxSizing: 'border-box',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              >
                
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 'bold', borderBottom: '2px solid black', display: 'inline-block', paddingBottom: '5px' }}>
                    支払明細書
                  </h1>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '40px', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '5px', width: '50%' }}>
                    {person.name} <span style={{ fontSize: '16px', marginLeft: '10px' }}>様</span>
                  </div>
                  <div style={{ fontSize: '14px', textAlign: 'right', lineHeight: '1.6' }}>
                    <div>発行日： {new Date().toLocaleDateString('ja-JP')}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', marginTop: '10px' }}>{ORGANIZATION_NAME || '鎌田緑保護会'}</div>
                  </div>
                </div>

                <div style={{ fontSize: '15px', marginBottom: '20px', lineHeight: '1.6' }}>
                  下記の通り、活動に対する報酬をお支払いいたします。<br />
                  <span style={{ fontWeight: 'bold' }}>対象期間・申請区分： {selectedPaymentLabel}</span>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', marginBottom: '40px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid black', padding: '12px', backgroundColor: '#f3f4f6', textAlign: 'center' }}>日付</th>
                      <th style={{ border: '1px solid black', padding: '12px', backgroundColor: '#f3f4f6', textAlign: 'left' }}>活動内容</th>
                      <th style={{ border: '1px solid black', padding: '12px', backgroundColor: '#f3f4f6', textAlign: 'right' }}>日当</th>
                      <th style={{ border: '1px solid black', padding: '12px', backgroundColor: '#f3f4f6', textAlign: 'right' }}>機械利用料</th>
                      <th style={{ border: '1px solid black', padding: '12px', backgroundColor: '#f3f4f6', textAlign: 'right' }}>小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.details.map((d, i) => (
                      <tr key={i}>
                        <td style={{ border: '1px solid black', padding: '10px', textAlign: 'center' }}>{d.date}</td>
                        <td style={{ border: '1px solid black', padding: '10px' }}>{d.activityName}</td>
                        <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right' }}>¥{d.wage.toLocaleString()}</td>
                        <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right' }}>¥{d.machine.toLocaleString()}</td>
                        <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right' }}>¥{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr>
                      <th colSpan={2} style={{ border: '1px solid black', padding: '12px', textAlign: 'center' }}>合計</th>
                      <td style={{ border: '1px solid black', padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>¥{person.wageTotal.toLocaleString()}</td>
                      <td style={{ border: '1px solid black', padding: '12px', textAlign: 'right', fontWeight: 'bold' }}>¥{person.machineTotal.toLocaleString()}</td>
                      <td style={{ border: '1px solid black', padding: '12px', textAlign: 'right', fontWeight: 'bold', fontSize: '16px' }}>¥{person.grandTotal.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                <div style={{ marginTop: '80px', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: '250px', borderBottom: '1px solid black', textAlign: 'left', paddingBottom: '5px', fontSize: '14px' }}>
                    受領印：
                  </div>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default ApplicationManagement;