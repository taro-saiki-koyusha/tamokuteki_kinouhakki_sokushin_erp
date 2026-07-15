import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { ArrowLeft, Wallet, Download, Search, Users, Tractor, Package, Loader2, Calendar, X, Printer, FileText, Lock, ChevronUp, ChevronDown } from 'lucide-react';
import { db, auth } from '../firebase';
import { ORGANIZATION_NAME } from '../constants';

const getFiscalYear = (dateString, startMonth = 4) => {
  if (!dateString) return new Date().getFullYear();
  const d = new Date(dateString);
  if (isNaN(d)) return new Date().getFullYear();
  
  return d.getMonth() < (startMonth - 1) ? d.getFullYear() - 1 : d.getFullYear();
};

export const CostManagement = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('personnel');

  const [activities, setActivities] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [materialsList, setMaterialsList] = useState([]); 
  const [groupsList, setGroupsList] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]); 
  
  const [systemSettings, setSystemSettings] = useState({ fiscalYearStartMonth: 4, paymentDates: [] });

  const [userRole, setUserRole] = useState('reporter');
  const [userGroupIds, setUserGroupIds] = useState([]);
  const [myName, setMyName] = useState(''); 

  const [selectedYear, setSelectedYear] = useState(getFiscalYear(new Date()).toString());
  const [selectedGroup, setSelectedGroup] = useState('all');

  const [selectedPerson, setSelectedPerson] = useState(null);

  const [includeUnimplemented, setIncludeUnimplemented] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), s => setMembersList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMachines = onSnapshot(collection(db, 'machines'), s => setMachinesList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubMaterials = onSnapshot(collection(db, 'materials'), s => setMaterialsList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubGroups = onSnapshot(collection(db, 'groups'), s => setGroupsList(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubUsers = onSnapshot(collection(db, 'users'), s => setSystemUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSystemSettings({
          fiscalYearStartMonth: data.fiscalYearStartMonth || 4,
          paymentDates: data.paymentDates || []
        });
      }
    });

    let unsubscribeActivities = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.exists() ? (userDoc.data().role || 'reporter') : 'reporter';
        const groupIds = userDoc.exists() ? (userDoc.data().groupIds || []) : [];
        const name = userDoc.exists() ? (userDoc.data().name || userDoc.data().displayName || user.displayName || '') : (user.displayName || '');
        
        setUserRole(role);
        setUserGroupIds(groupIds);
        setMyName(name);

        let q;
        if (role === 'admin' || role === 'manager') {
          q = query(collection(db, 'activities'));
        } else {
          if (groupIds.length === 0) {
            setActivities([]);
            setLoading(false);
            return;
          }
          q = query(collection(db, 'activities'), where('groupId', 'in', groupIds));
        }

        unsubscribeActivities = onSnapshot(q, (snapshot) => {
          setActivities(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        });
      } else {
        navigate('/');
      }
    });

    return () => {
      unsubMembers(); unsubMachines(); unsubMaterials(); unsubGroups(); unsubUsers(); unsubscribeAuth(); unsubSettings();
      if (unsubscribeActivities) unsubscribeActivities();
    };
  }, [navigate]);

  const availableYears = useMemo(() => {
    const years = activities.map(act => getFiscalYear(act.date, systemSettings.fiscalYearStartMonth));
    const uniqueYears = [...new Set(years)].sort((a, b) => b - a);
    if (uniqueYears.length === 0) return [getFiscalYear(new Date(), systemSettings.fiscalYearStartMonth)];
    return uniqueYears;
  }, [activities, systemSettings.fiscalYearStartMonth]);

  useEffect(() => {
    if (selectedYear !== 'all' && availableYears.length > 0) {
      if (!availableYears.includes(Number(selectedYear))) {
        setSelectedYear(getFiscalYear(new Date(), systemSettings.fiscalYearStartMonth).toString());
      }
    }
  }, [systemSettings.fiscalYearStartMonth, availableYears, selectedYear]);

  const filteredActivities = useMemo(() => {
    return activities.filter(act => {
      const actFY = getFiscalYear(act.date, systemSettings.fiscalYearStartMonth).toString();
      const matchYear = selectedYear === 'all' || actFY === selectedYear;
      const matchGroup = selectedGroup === 'all' || act.groupId === selectedGroup;
      const isCompleted = act.status !== '未実施';
      
      if (!matchYear || !matchGroup || (!includeUnimplemented && !isCompleted)) return false;

      if (userRole === 'reporter') {
        const participated = (act.participantDetails || []).some(pd => {
          const wId = pd.wageId || pd.memberId;
          const wage = membersList.find(m => m.id === wId);
          const pName = pd.participantName || wage?.name || '名称未設定';
          return pName === myName;
        });
        if (!participated) return false;
      }
      
      return true;
    }).sort((a, b) => new Date(a.date) - new Date(b.date)); 
  }, [activities, selectedYear, selectedGroup, userRole, myName, membersList, systemSettings.fiscalYearStartMonth, includeUnimplemented]); 

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const aggregatedData = useMemo(() => {
    let totalPersonnelCost = 0;
    let totalPersonnelHours = 0;
    let totalMachineCost = 0;
    let totalMachineHours = 0;
    let totalMaterialCost = 0;

    const personMap = {};

    filteredActivities.forEach(act => {
      if (userRole === 'admin' || userRole === 'manager') {
        (act.materialDetails || []).forEach(md => {
          const mat = materialsList.find(m => m.id === md.materialId);
          if (mat) {
            totalMaterialCost += (md.quantity || 0) * (mat.defaultPrice || 0);
          }
        });
      }

      const groupInfo = groupsList.find(g => g.id === act.groupId);
      const paymentInfo = (systemSettings.paymentDates || []).find(p => p.id === act.paymentDateId);
      const paymentLabel = paymentInfo ? `${paymentInfo.label}` : '未定';

      (act.participantDetails || []).forEach(pd => {
        const wId = pd.wageId || pd.memberId;
        const wage = membersList.find(m => m.id === wId);
        const machine = machinesList.find(m => m.id === pd.machineId);

        const participantName = pd.participantName || wage?.name || '名称未設定';

        if (userRole === 'reporter' && participantName !== myName) {
          return;
        }

        const pCost = (pd.workTime || 0) * (wage?.defaultWage || 0);
        const mCost = (pd.machineTime || 0) * (machine?.defaultPrice || 0);
        const totalIndividualCost = pCost + mCost;

        totalPersonnelCost += pCost;
        totalPersonnelHours += (pd.workTime || 0);
        totalMachineCost += mCost;
        totalMachineHours += (pd.machineTime || 0);

        const matchedUser = systemUsers.find(u => (u.displayName || u.name) === participantName);
        const memberNo = matchedUser?.memberNo ? matchedUser.memberNo : '';

        // ★追加: クロス集計（マトリックス）用の初期化
        if (!personMap[participantName]) {
          personMap[participantName] = { 
            name: participantName, 
            memberNo: memberNo, 
            workTime: 0, 
            pCost: 0, 
            machineTime: 0, 
            mCost: 0,
            groupTotals: { other: 0 }, 
            details: []
          };
          groupsList.forEach(g => personMap[participantName].groupTotals[g.id] = 0);
        }
        
        personMap[participantName].workTime += (pd.workTime || 0);
        personMap[participantName].pCost += pCost;
        personMap[participantName].machineTime += (pd.machineTime || 0);
        personMap[participantName].mCost += mCost;
        
        // ★追加: グループごとの金額を加算（属していない場合はotherへ）
        const actualGid = groupsList.some(g => g.id === act.groupId) ? act.groupId : 'other';
        personMap[participantName].groupTotals[actualGid] += totalIndividualCost;
        
        personMap[participantName].details.push({
          id: act.id,
          date: act.date,
          activityType: act.activityType,
          groupName: groupInfo ? groupInfo.name : '未登録',
          paymentLabel: paymentLabel, 
          workTime: pd.workTime || 0,
          pCost: pCost,
          machineTime: pd.machineTime || 0,
          mCost: mCost,
          total: totalIndividualCost
        });
      });
    });

    const personnelArray = Object.values(personMap).sort((a, b) => {
      let comparison = 0;
      
      if (sortConfig.key === 'name') {
        if (a.memberNo === '' && b.memberNo !== '') comparison = 1;
        else if (a.memberNo !== '' && b.memberNo === '') comparison = -1;
        else comparison = (a.memberNo || '').toString().localeCompare((b.memberNo || '').toString(), 'ja', { numeric: true });
        
        if (comparison === 0) {
          comparison = (a.name || '').localeCompare((b.name || ''), 'ja');
        }
      } else if (sortConfig.key === 'total') {
        const totalA = a.pCost + a.mCost;
        const totalB = b.pCost + b.mCost;
        comparison = totalA - totalB;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return {
      totalPersonnelCost, totalPersonnelHours,
      totalMachineCost, totalMachineHours,
      totalMaterialCost,
      grandTotal: totalPersonnelCost + totalMachineCost + totalMaterialCost,
      personnelArray
    };
  }, [filteredActivities, membersList, machinesList, materialsList, groupsList, systemUsers, userRole, myName, systemSettings.paymentDates, sortConfig]);

  const handleExportDummy = () => {
    alert("全員分の支払明細一括出力機能は現在準備中です。\n※個人別の明細は、表の名前をクリックして「PDF出力」から印刷可能です。");
  };

  const handlePrintDetail = () => {
    setTimeout(() => { window.print(); }, 150);
  };

  const selectableGroups = (userRole === 'admin' || userRole === 'manager') 
    ? groupsList 
    : groupsList.filter(g => userGroupIds.includes(g.id));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-12 h-12 text-green-600 animate-spin mb-4" />
        <p className="text-green-800 font-bold">データを集計しています...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 print:bg-white print:pb-0">
      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 15mm; size: A4; }
          .no-print { display: none !important; }
        }
      `}</style>

      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print" onClick={() => setSelectedPerson(null)}>
          <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 md:p-5 border-b border-gray-100 bg-gray-50">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
                <FileText className="mr-2 text-blue-600" size={24} />
                {selectedPerson.name} 様 の作業明細
              </h2>
              <div className="flex items-center space-x-2">
                <button onClick={handlePrintDetail} className="bg-gray-800 text-white px-3 py-1.5 md:px-4 md:py-2 rounded-lg text-sm font-bold flex items-center hover:bg-gray-700 transition-colors shadow-sm">
                  <Printer size={16} className="mr-1.5" /> PDF出力
                </button>
                <button onClick={() => setSelectedPerson(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>
            </div>
            
            <div className="p-5 md:p-6 overflow-y-auto flex-1">
              <div className="flex flex-wrap gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl flex-1 min-w-[150px]">
                  <div className="text-xs font-bold text-blue-800 mb-1">人件費 合計</div>
                  <div className="text-xl font-black text-gray-900">¥{selectedPerson.pCost.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{selectedPerson.workTime} 時間</div>
                </div>
                <div className="bg-orange-50 border border-orange-100 px-4 py-3 rounded-xl flex-1 min-w-[150px]">
                  <div className="text-xs font-bold text-orange-800 mb-1">機械借上費 合計</div>
                  <div className="text-xl font-black text-gray-900">¥{selectedPerson.mCost.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{selectedPerson.machineTime} 時間</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 px-4 py-3 rounded-xl flex-1 min-w-[200px]">
                  <div className="text-xs font-bold text-gray-500 mb-1">支払合計額</div>
                  <div className="text-2xl font-black text-blue-700">¥{(selectedPerson.pCost + selectedPerson.mCost).toLocaleString()}</div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                      <th className="p-3 font-bold">日付</th>
                      <th className="p-3 font-bold">活動内容</th>
                      <th className="p-3 font-bold">グループ</th>
                      <th className="p-3 font-bold">振込時期</th> 
                      <th className="p-3 font-bold text-right">作業時間</th>
                      <th className="p-3 font-bold text-right">人件費</th>
                      <th className="p-3 font-bold text-right">機械時間</th>
                      <th className="p-3 font-bold text-right">機械費</th>
                      <th className="p-3 font-bold text-right text-blue-700 bg-blue-50/50">活動小計</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedPerson.details.map((detail, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 text-sm">
                        <td className="p-3 text-gray-600 whitespace-nowrap">{detail.date}</td>
                        <td className="p-3 font-bold text-gray-900">{detail.activityType}</td>
                        <td className="p-3 text-xs text-gray-500">{detail.groupName}</td>
                        <td className="p-3 text-xs text-purple-600 font-bold whitespace-nowrap">{detail.paymentLabel}</td>
                        <td className="p-3 text-right text-gray-600">{detail.workTime}h</td>
                        <td className="p-3 text-right text-gray-600 font-mono">¥{detail.pCost.toLocaleString()}</td>
                        <td className="p-3 text-right text-gray-600">{detail.machineTime}h</td>
                        <td className="p-3 text-right text-gray-600 font-mono">¥{detail.mCost.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/30 font-mono">
                          ¥{detail.total.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="no-print">
        <header className="bg-white shadow-sm px-4 md:px-8 py-3 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center">
            <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-gray-800 flex items-center">
              <Wallet className="w-6 h-6 mr-2 text-green-600" />
              {userRole === 'reporter' ? 'あなたの作業実績' : '作業費・実績集計'}
            </h1>
          </div>
          {(userRole === 'admin' || userRole === 'manager') && (
            <button onClick={handleExportDummy} className="bg-blue-50 text-blue-700 px-3 py-2 md:px-4 rounded-lg text-sm font-bold flex items-center hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm active:scale-95">
              <Download size={18} className="md:mr-1.5" /> <span className="hidden sm:inline">支払明細</span>一括出力
            </button>
          )}
        </header>

        <main className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200 flex flex-wrap gap-4 items-center">
            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-sm font-bold text-gray-600 mr-2 shrink-0">対象年度:</span>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-transparent border-none font-bold text-gray-800 focus:ring-0 cursor-pointer text-sm p-0 w-full"
              >
                <option value="all">全期間</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>令和{year - 2018}年度 ({year})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-sm font-bold text-gray-600 mr-2 shrink-0">グループ:</span>
              <select 
                value={selectedGroup} 
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="bg-transparent border-none font-bold text-gray-800 focus:ring-0 cursor-pointer text-sm p-0 w-full max-w-[200px] truncate"
              >
                <option value="all">すべて</option>
                {selectableGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center ml-auto gap-3">
              <label className="flex items-center text-xs font-bold text-gray-600 cursor-pointer bg-gray-50 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <input 
                  type="checkbox" 
                  checked={includeUnimplemented}
                  onChange={(e) => setIncludeUnimplemented(e.target.checked)}
                  className="mr-1.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                未実施を含む
              </label>
              <div className="text-sm font-bold text-gray-500 bg-white border border-gray-200 px-4 py-2 rounded-xl flex items-center">
                <Calendar size={16} className="mr-1.5" />
                対象レコード：<span className="text-blue-600 ml-1 text-base">{filteredActivities.length}</span> 件
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${userRole === 'reporter' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-blue-100 border-l-4 border-l-blue-500">
              <div className="text-sm font-bold text-gray-500 mb-1 flex items-center">
                <Users size={16} className="mr-1 text-blue-500"/>
                {userRole === 'reporter' ? 'あなたの人件費' : '人件費 合計'}
              </div>
              <div className="text-2xl font-black text-gray-800">¥{aggregatedData.totalPersonnelCost.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">のべ {aggregatedData.totalPersonnelHours}時間</div>
            </div>
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-orange-100 border-l-4 border-l-orange-500">
              <div className="text-sm font-bold text-gray-500 mb-1 flex items-center">
                <Tractor size={16} className="mr-1 text-orange-500"/>
                {userRole === 'reporter' ? 'あなたの機械提供費' : '機械借上費 合計'}
              </div>
              <div className="text-2xl font-black text-gray-800">¥{aggregatedData.totalMachineCost.toLocaleString()}</div>
              <div className="text-xs text-gray-400 mt-1">のべ {aggregatedData.totalMachineHours}時間</div>
            </div>
            
            {(userRole === 'admin' || userRole === 'manager') && (
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-purple-100 border-l-4 border-l-purple-500">
                <div className="text-sm font-bold text-gray-500 mb-1 flex items-center"><Package size={16} className="mr-1 text-purple-500"/>資材費 合計</div>
                <div className="text-2xl font-black text-gray-800">¥{aggregatedData.totalMaterialCost.toLocaleString()}</div>
                <div className="text-xs text-gray-400 mt-1">※登録資材の概算額</div>
              </div>
            )}

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-2xl shadow-sm border border-blue-200">
              <div className="text-sm font-bold text-blue-800 mb-1">
                {userRole === 'reporter' ? 'あなたの支払予定額' : '実績総合計'}
              </div>
              <div className="text-3xl font-black text-blue-700">¥{aggregatedData.grandTotal.toLocaleString()}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button onClick={() => setActiveTab('personnel')} className={`flex-1 py-3.5 font-bold text-sm transition-colors ${activeTab === 'personnel' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                {userRole === 'reporter' ? 'あなたの集計結果' : '個人別 支払額集計'}
              </button>
              {/* ★追加: 新しい「クロス集計」のタブ */}
              <button onClick={() => setActiveTab('group')} className={`flex-1 py-3.5 font-bold text-sm transition-colors ${activeTab === 'group' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                グループ別 費用集計
              </button>
              <button onClick={() => setActiveTab('activity')} className={`flex-1 py-3.5 font-bold text-sm transition-colors ${activeTab === 'activity' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}>
                活動別 費用一覧
              </button>
            </div>

            <div className="p-0 overflow-x-auto">
              {activeTab === 'personnel' && (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                      <th 
                        className="p-4 font-bold cursor-pointer hover:bg-gray-200 transition-colors select-none group"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          氏名 (構成員番号)
                          {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={16} className="ml-1 text-blue-600" /> : <ChevronDown size={16} className="ml-1 text-blue-600" />) : <ChevronDown size={16} className="ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </th>
                      <th className="p-4 font-bold text-right">作業時間</th>
                      <th className="p-4 font-bold text-right">人件費小計</th>
                      <th className="p-4 font-bold text-right">機械提供時間</th>
                      <th className="p-4 font-bold text-right">機械費小計</th>
                      <th 
                        className="p-4 font-bold text-right text-blue-700 bg-blue-50/50 cursor-pointer hover:bg-blue-100 transition-colors select-none group"
                        onClick={() => handleSort('total')}
                      >
                        <div className="flex items-center justify-end">
                          支払合計額
                          {sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? <ChevronUp size={16} className="ml-1 text-blue-800" /> : <ChevronDown size={16} className="ml-1 text-blue-800" />) : <ChevronDown size={16} className="ml-1 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aggregatedData.personnelArray.map((person, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPerson(person)}
                        title="クリックして明細を表示"
                      >
                        <td className="p-4 font-bold text-gray-800 whitespace-nowrap group-hover:text-blue-700">
                          {person.name} 
                          <span className="text-xs text-gray-400 font-normal ml-2 font-mono">
                            {person.memberNo ? `(${person.memberNo})` : '(-)'}
                          </span>
                        </td>
                        <td className="p-4 text-right text-gray-600">{person.workTime} h</td>
                        <td className="p-4 text-right text-gray-600 font-mono">¥{person.pCost.toLocaleString()}</td>
                        <td className="p-4 text-right text-gray-600">{person.machineTime} h</td>
                        <td className="p-4 text-right text-gray-600 font-mono">¥{person.mCost.toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-blue-700 bg-blue-50/30 font-mono text-lg group-hover:bg-blue-100/50">
                          ¥{(person.pCost + person.mCost).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {aggregatedData.personnelArray.length === 0 && (
                      <tr><td colSpan="6" className="p-8 text-center text-gray-400 font-bold">対象データがありません</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {/* ★追加: 個人×グループのクロス集計テーブル */}
              {activeTab === 'group' && (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                      <th 
                        className="p-4 font-bold cursor-pointer hover:bg-gray-200 transition-colors select-none group sticky left-0 z-10 bg-gray-50"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center">
                          氏名 (構成員番号)
                          {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? <ChevronUp size={16} className="ml-1 text-blue-600" /> : <ChevronDown size={16} className="ml-1 text-blue-600" />) : <ChevronDown size={16} className="ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </th>
                      {/* 登録されている全グループを列として展開 */}
                      {groupsList.map(g => (
                        <th key={g.id} className="p-4 font-bold text-right border-l border-gray-200">
                          <div className="text-[10px] text-gray-400 font-normal leading-tight">グループ</div>
                          {g.name}
                        </th>
                      ))}
                      <th className="p-4 font-bold text-right border-l border-gray-200">
                        <div className="text-[10px] text-gray-400 font-normal leading-tight">未分類</div>
                        その他
                      </th>
                      <th 
                        className="p-4 font-bold text-right text-blue-700 bg-blue-50/50 cursor-pointer hover:bg-blue-100 transition-colors select-none group border-l border-gray-200"
                        onClick={() => handleSort('total')}
                      >
                        <div className="flex items-center justify-end">
                          支払合計額
                          {sortConfig.key === 'total' ? (sortConfig.direction === 'asc' ? <ChevronUp size={16} className="ml-1 text-blue-800" /> : <ChevronDown size={16} className="ml-1 text-blue-800" />) : <ChevronDown size={16} className="ml-1 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {aggregatedData.personnelArray.map((person, idx) => (
                      <tr 
                        key={idx} 
                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                        onClick={() => setSelectedPerson(person)}
                        title="クリックして明細を表示"
                      >
                        <td className="p-4 font-bold text-gray-800 whitespace-nowrap group-hover:text-blue-700 sticky left-0 z-10 bg-white group-hover:bg-blue-50">
                          {person.name} 
                          <span className="text-xs text-gray-400 font-normal ml-2 font-mono">
                            {person.memberNo ? `(${person.memberNo})` : '(-)'}
                          </span>
                        </td>
                        {/* グループごとの金額 */}
                        {groupsList.map(g => {
                          const amount = person.groupTotals[g.id] || 0;
                          return (
                            <td key={g.id} className={`p-4 text-right font-mono border-l border-gray-100 ${amount > 0 ? 'text-gray-800 font-bold' : 'text-gray-300'}`}>
                              ¥{amount.toLocaleString()}
                            </td>
                          );
                        })}
                        {/* その他の金額 */}
                        <td className={`p-4 text-right font-mono border-l border-gray-100 ${(person.groupTotals['other'] || 0) > 0 ? 'text-gray-800 font-bold' : 'text-gray-300'}`}>
                          ¥{(person.groupTotals['other'] || 0).toLocaleString()}
                        </td>
                        {/* 支払合計 */}
                        <td className="p-4 text-right font-black text-blue-700 bg-blue-50/30 font-mono text-lg border-l border-gray-200 group-hover:bg-blue-100/50">
                          ¥{(person.pCost + person.mCost).toLocaleString()}
                        </td>
                      </tr>
                    ))}

                    {/* ★追加: グループごとの縦の合計行 */}
                    {aggregatedData.personnelArray.length > 0 && (() => {
                      const footerTotals = { other: 0, grand: 0 };
                      groupsList.forEach(g => footerTotals[g.id] = 0);
                      
                      aggregatedData.personnelArray.forEach(p => {
                        groupsList.forEach(g => footerTotals[g.id] += (p.groupTotals[g.id] || 0));
                        footerTotals.other += (p.groupTotals.other || 0);
                        footerTotals.grand += (p.pCost + p.mCost);
                      });

                      return (
                        <tr className="bg-gray-100 border-t-2 border-gray-300 text-sm">
                          <td className="p-4 font-black text-center text-gray-700 sticky left-0 z-10 bg-gray-100">総合計</td>
                          {groupsList.map(g => (
                            <td key={g.id} className="p-4 text-right font-black text-gray-800 font-mono border-l border-gray-300">
                              ¥{footerTotals[g.id].toLocaleString()}
                            </td>
                          ))}
                          <td className="p-4 text-right font-black text-gray-800 font-mono border-l border-gray-300">
                            ¥{footerTotals.other.toLocaleString()}
                          </td>
                          <td className="p-4 text-right font-black text-blue-800 bg-blue-100/50 font-mono text-xl border-l border-blue-200">
                            ¥{footerTotals.grand.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })()}

                    {aggregatedData.personnelArray.length === 0 && (
                      <tr><td colSpan={groupsList.length + 3} className="p-8 text-center text-gray-400 font-bold">対象データがありません</td></tr>
                    )}
                  </tbody>
                </table>
              )}

              {activeTab === 'activity' && (
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
                      <th className="p-4 font-bold">日付</th>
                      <th className="p-4 font-bold">活動内容</th>
                      <th className="p-4 font-bold">グループ</th>
                      <th className="p-4 font-bold text-right">{userRole === 'reporter' ? 'あなたの人件費' : '人件費'}</th>
                      <th className="p-4 font-bold text-right">{userRole === 'reporter' ? 'あなたの機械費' : '機械費'}</th>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <th className="p-4 font-bold text-right">資材費</th>
                      )}
                      <th className="p-4 font-bold text-right text-blue-700 bg-blue-50/50">合計額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredActivities.map((act) => {
                      let pC = 0, mC = 0, matC = 0;
                      
                      (act.participantDetails || []).forEach(pd => {
                        const wage = membersList.find(m => m.id === (pd.wageId || pd.memberId));
                        const machine = machinesList.find(m => m.id === pd.machineId);
                        const pName = pd.participantName || wage?.name || '名称未設定';

                        if (userRole === 'reporter' && pName !== myName) return;

                        pC += (pd.workTime || 0) * (wage?.defaultWage || 0);
                        mC += (pd.machineTime || 0) * (machine?.defaultPrice || 0);
                      });

                      if (userRole === 'admin' || userRole === 'manager') {
                        (act.materialDetails || []).forEach(md => {
                          const mat = materialsList.find(m => m.id === md.materialId);
                          if (mat) matC += (md.quantity || 0) * (mat.defaultPrice || 0);
                        });
                      }

                      const groupInfo = groupsList.find(g => g.id === act.groupId);

                      return (
                        <tr key={act.id} onClick={() => navigate(`/activity-form/${act.id}`, { state: { editData: act, isViewMode: true } })} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                          <td className="p-4 text-sm text-gray-600 whitespace-nowrap">{act.date}</td>
                          
                          <td className="p-4 text-sm font-bold text-gray-900 truncate max-w-[200px]">
                            <div className="flex items-center gap-2">
                              <span className="truncate">{act.activityType}</span>
                              {act.isLocked && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-gray-600 text-white flex items-center whitespace-nowrap shadow-sm border border-gray-500 shrink-0">
                                  <Lock size={10} className="mr-1" /> 提出済
                                </span>
                              )}
                            </div>
                          </td>
                          
                          <td className="p-4 text-xs text-gray-500">{groupInfo?.name || '-'}</td>
                          <td className="p-4 text-right text-gray-600 font-mono">¥{pC.toLocaleString()}</td>
                          <td className="p-4 text-right text-gray-600 font-mono">¥{mC.toLocaleString()}</td>
                          
                          {(userRole === 'admin' || userRole === 'manager') && (
                            <td className="p-4 text-right text-gray-600 font-mono">¥{matC.toLocaleString()}</td>
                          )}
                          
                          <td className="p-4 text-right font-bold text-blue-700 bg-blue-50/30 font-mono group-hover:bg-blue-100/50 transition-colors">
                            ¥{(pC + mC + matC).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredActivities.length === 0 && (
                      <tr><td colSpan={userRole === 'reporter' ? "6" : "7"} className="p-8 text-center text-gray-400 font-bold">対象データがありません</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedPerson && (
        <div className="hidden print:block w-full text-black bg-white font-serif">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold border-b-2 border-black pb-2 inline-block px-10">作業費・実績明細書</h1>
          </div>
          
          <div className="flex justify-between items-end mb-6">
            <div className="text-xl font-bold border-b border-black pb-1 min-w-[250px]">
              {selectedPerson.name} <span className="text-lg font-normal ml-2">様</span>
            </div>
            <div className="text-right">
              <div className="text-sm mb-1">出力日: {new Date().toLocaleDateString('ja-JP')}</div>
              <div className="text-sm font-bold">組織名: {ORGANIZATION_NAME || '鎌田地区'}</div>
              <div className="text-sm">対象年度: {selectedYear === 'all' ? '全期間' : `令和${selectedYear - 2018}年度`}</div>
            </div>
          </div>

          <div className="mb-6 flex justify-end">
            <table className="border-2 border-black border-collapse text-sm w-1/2">
              <tbody>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 text-center w-1/2">人件費 合計</th>
                  <td className="border border-black p-2 text-right font-bold">¥{selectedPerson.pCost.toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 text-center">機械借上費 合計</th>
                  <td className="border border-black p-2 text-right font-bold">¥{selectedPerson.mCost.toLocaleString()}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-2 text-center text-base">支払合計額</th>
                  <td className="border border-black p-2 text-right font-bold text-lg">¥{(selectedPerson.pCost + selectedPerson.mCost).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="text-sm font-bold mb-2">■ 作業明細一覧</div>
          <table className="w-full border border-black border-collapse text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-black p-2 text-center w-24">日付</th>
                <th className="border border-black p-2 text-center">活動内容</th>
                <th className="border border-black p-2 text-center w-24">振込時期</th> 
                <th className="border border-black p-2 text-center w-16">作業時間</th>
                <th className="border border-black p-2 text-center w-24">人件費</th>
                <th className="border border-black p-2 text-center w-16">機械時間</th>
                <th className="border border-black p-2 text-center w-24">機械費</th>
                <th className="border border-black p-2 text-center w-24">活動小計</th>
              </tr>
            </thead>
            <tbody>
              {selectedPerson.details.map((detail, idx) => (
                <tr key={idx}>
                  <td className="border border-black p-2 text-center">{detail.date}</td>
                  <td className="border border-black p-2">{detail.activityType}</td>
                  <td className="border border-black p-2 text-center">{detail.paymentLabel}</td> 
                  <td className="border border-black p-2 text-right">{detail.workTime} h</td>
                  <td className="border border-black p-2 text-right">¥{detail.pCost.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right">{detail.machineTime} h</td>
                  <td className="border border-black p-2 text-right">¥{detail.mCost.toLocaleString()}</td>
                  <td className="border border-black p-2 text-right font-bold">¥{detail.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CostManagement;