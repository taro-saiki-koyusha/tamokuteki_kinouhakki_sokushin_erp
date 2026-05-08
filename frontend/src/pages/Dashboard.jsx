import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Plus, Settings, LogOut, Sprout, Users, UserCog, MessageSquare, Trash2, X, MapPin, BarChart2, Activity, Printer, FileSpreadsheet, LayoutList, Layers, AlertTriangle, LayoutGrid, List, ChevronUp, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [printActivity, setPrintActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [exportingId, setExportingId] = useState(null);
  
  const [membersList, setMembersList] = useState([]);
  const [machinesList, setMachinesList] = useState([]);
  const [materialsList, setMaterialsList] = useState([]); 
  const [groupsList, setGroupsList] = useState([]);

  const [displayMode, setDisplayMode] = useState(() => localStorage.getItem('dashboardDisplayMode') || 'group');
  const [viewStyle, setViewStyle] = useState(() => localStorage.getItem('dashboardViewStyle') || 'card');
  const [dateSortOrder, setDateSortOrder] = useState(() => localStorage.getItem('dashboardDateSortOrder') || 'desc');

  useEffect(() => localStorage.setItem('dashboardDisplayMode', displayMode), [displayMode]);
  useEffect(() => localStorage.setItem('dashboardViewStyle', viewStyle), [viewStyle]);
  useEffect(() => localStorage.setItem('dashboardDateSortOrder', dateSortOrder), [dateSortOrder]);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');
  const [userGroupIds, setUserGroupIds] = useState([]);
  const [deletingActivityId, setDeletingActivityId] = useState(null);

  useEffect(() => {
    const unsubMembers = onSnapshot(collection(db, 'members'), (snapshot) => {
      setMembersList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMachines = onSnapshot(collection(db, 'machines'), (snapshot) => {
      setMachinesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMaterials = onSnapshot(collection(db, 'materials'), (snapshot) => {
      setMaterialsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroupsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    let unsubscribeData = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const role = userDoc.exists() ? (userDoc.data().role || 'reporter') : 'reporter';
        const groupIds = userDoc.exists() ? (userDoc.data().groupIds || []) : [];
        
        setUserRole(role);
        setUserGroupIds(groupIds);

        let q;
        if (role === 'admin' || role === 'manager') {
          q = query(collection(db, 'activities'));
        } else {
          if (groupIds.length === 0) {
            setActivities([]);
            setLoading(false);
            return;
          }
          import('firebase/firestore').then(({ where }) => {
            q = query(collection(db, 'activities'), where('groupId', 'in', groupIds));
            unsubscribeData = onSnapshot(q, (querySnapshot) => {
              const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              setActivities(data);
              setLoading(false);
            });
          });
          return; 
        }

        unsubscribeData = onSnapshot(q, (querySnapshot) => {
          const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setActivities(data);
          setLoading(false);
        });

      } else {
        setActivities([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeGroups();
      unsubMembers();
      unsubMachines();
      unsubMaterials();
      if (unsubscribeData) unsubscribeData();
    };
  }, []);

  const globalSortedActivities = useMemo(() => {
    return [...activities].sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [activities, dateSortOrder]);

  const groupedActivities = useMemo(() => {
    const groups = {};
    globalSortedActivities.forEach(act => {
      const gid = act.groupId || 'unknown';
      if (!groups[gid]) groups[gid] = [];
      groups[gid].push(act);
    });
    return groups;
  }, [globalSortedActivities]);

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/'); } catch (error) { console.error(error); }
  };

  const handleDeleteClick = (id, e) => {
    e.stopPropagation(); 
    setDeletingActivityId(id);
  };

  const executeDelete = async () => {
    if (!deletingActivityId) return;
    try {
      await deleteDoc(doc(db, 'activities', deletingActivityId));
      setDeletingActivityId(null);
    } catch (error) {
      console.error("削除エラー:", error);
      alert('削除に失敗しました。');
    }
  };

  const handleExportSingleReport = async (activity) => {
    setExportingId(activity.id); 
    try {
      const response = await fetch(`/様式1_活動報告書_農地維持支払.xlsx?t=${Date.now()}`);
      if (!response.ok) throw new Error('テンプレートが見つかりません');
      const arrayBuffer = await response.arrayBuffer();
      const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
      const sheet1 = workbook.sheet('活動報告書') || workbook.sheets()[0];
      const [startH, startM] = activity.startTime.split(':').map(Number);
      const [endH, endM] = activity.endTime.split(':').map(Number);
      let duration = (endH + endM / 60) - (startH + startM / 60);
      if (duration < 0) duration += 24;
      sheet1.cell('AH3').value(activity.reportNo || ''); 
      sheet1.cell('A7').value(activity.date); 
      sheet1.cell('C7').value(activity.startTime); 
      sheet1.cell('F7').value(activity.endTime);   
      sheet1.cell('I7').value(duration); 
      sheet1.cell('M7').value(Number(activity.participantsAgri || 0)); 
      sheet1.cell('O7').value(Number(activity.participantsNonAgri || 0)); 
      sheet1.cell('Q7').value(Number(activity.participants || 0)); 
      sheet1.cell('S7').value(activity.activityNumbers?.join(', ')); 
      sheet1.cell('AA7').value(activity.activityType || '');          
      sheet1.cell('A8').value(activity.memo || '');
      const sheet2 = workbook.sheet('日当借上支払明細') || workbook.sheets()[1];
      sheet2.cell('AJ3').value(activity.date); 
      if (activity.participantDetails && activity.participantDetails.length > 0) {
        activity.participantDetails.forEach((detail, index) => {
          const row = 6 + index; 
          const wId = detail.wageId || detail.memberId;
          const wage = membersList.find(m => m.id === wId);
          const machine = machinesList.find(m => m.id === detail.machineId);
          
          let memberTotal = 0; let machineTotal = 0;
          if (wage) {
            memberTotal = detail.workTime * wage.defaultWage;
            sheet2.cell(`A${row}`).value(detail.participantName || '名称未設定'); 
            sheet2.cell(`F${row}`).value(wage.name); 
            sheet2.cell(`G${row}`).value(detail.workTime); 
            sheet2.cell(`J${row}`).value('時間'); 
            sheet2.cell(`L${row}`).value(wage.defaultWage); 
            sheet2.cell(`O${row}`).value(memberTotal); 
          }
          if (machine) {
            machineTotal = detail.machineTime * machine.defaultPrice;
            sheet2.cell(`S${row}`).value(machine.name); 
            sheet2.cell(`X${row}`).value(detail.machineTime); 
            sheet2.cell(`AA${row}`).value('時間'); 
            sheet2.cell(`AC${row}`).value(machine.defaultPrice); 
            sheet2.cell(`AF${row}`).value(machineTotal); 
          }
          sheet2.cell(`AJ${row}`).value(memberTotal + machineTotal);
        });
      }
      const blob = await workbook.outputAsync();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `活動報告書_${activity.date}.xlsx`; 
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) { console.error(error); alert('Excel作成エラー'); } finally { setExportingId(null); }
  };

  const handleDirectPrint = (activity) => {
    setPrintActivity(activity);
    setTimeout(() => { window.print(); }, 150);
  };

  const roleLabel = userRole === 'admin' ? '管理者' : userRole === 'manager' ? '事務・役員' : '現場リーダー';

  const ActivityCard = ({ activity }) => {
    const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
    const isThisExporting = exportingId === activity.id;
    const canExport = userRole === 'admin' || userRole === 'manager';
    const groupInfo = groupsList.find(g => g.id === activity.groupId);

    return (
      <div onClick={() => navigate('/activity-form', { state: { editData: activity, isViewMode: true } })} className="bg-white rounded-2xl shadow-sm border-l-4 border-green-500 p-4 cursor-pointer hover:shadow-md transition-all flex flex-col h-full relative group">
        <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
          {groupInfo ? (
            <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-1 rounded-md font-bold">{groupInfo.name}</span>
          ) : (
            <span className="bg-red-50 text-red-500 text-[10px] px-2 py-1 rounded-md font-bold border border-red-100">未登録</span>
          )}
          {userRole === 'admin' && (
            <button onClick={(e) => handleDeleteClick(activity.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="この実績を削除">
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <h3 className="font-bold text-lg text-gray-900 mb-2 pr-32 leading-tight">{activity.activityType || '内容未入力'}</h3>
        <div className="space-y-1.5 text-xs text-gray-600 mb-3 flex-grow">
          {activity.reportNo && <div className="flex items-center text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-max mb-1">NO: {activity.reportNo}</div>}
          <div className="flex items-center"><Calendar className="mr-2 h-4 w-4" />{activity.date}</div>
          <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" />{activity.location}</div>
        </div>
        {images.length > 0 && (
          <div className="relative rounded-lg overflow-hidden h-32 bg-gray-50 border border-gray-100 mb-3">
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {canExport && (
          <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
            <button onClick={(e) => { e.stopPropagation(); handleExportSingleReport(activity); }} disabled={isThisExporting} className={`flex-1 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center transition-colors ${isThisExporting ? 'bg-blue-400 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
              <FileSpreadsheet size={14} className="mr-1" />{isThisExporting ? '生成中...' : 'Excel'}
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDirectPrint(activity); }} className="flex-1 bg-gray-50 text-gray-700 border border-gray-200 py-2 rounded-xl font-bold text-[10px] flex items-center justify-center hover:bg-gray-100">
              <Printer size={14} className="mr-1" /> PDF
            </button>
          </div>
        )}
      </div>
    );
  };

  const ActivityTable = ({ activitiesToRender }) => {
    const toggleDateSort = () => {
      setDateSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    };

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-700">
                <th onClick={toggleDateSort} className="p-3 font-bold w-32 cursor-pointer hover:bg-gray-200 transition-colors select-none group" title="日付で並び替え">
                  <div className="flex items-center text-blue-700">
                    日付
                    {dateSortOrder === 'desc' ? <ChevronDown size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" /> : <ChevronUp size={16} className="ml-1 text-blue-600 group-hover:text-blue-800" />}
                  </div>
                </th>
                <th className="p-3 font-bold w-28">報告書NO</th>
                <th className="p-3 font-bold w-36">グループ</th>
                <th className="p-3 font-bold w-48">活動場所</th>
                <th className="p-3 font-bold">活動内容</th>
                <th className="p-3 font-bold w-16 text-center">写真</th>
                {(userRole === 'admin' || userRole === 'manager') && <th className="p-3 font-bold w-40 text-center">出力</th>}
                {userRole === 'admin' && <th className="p-3 font-bold w-16 text-center">削除</th>}
              </tr>
            </thead>
            <tbody>
              {activitiesToRender.map(act => {
                const groupInfo = groupsList.find(g => g.id === act.groupId);
                const isThisExporting = exportingId === act.id;
                const canExport = userRole === 'admin' || userRole === 'manager';
                const hasImage = (act.imageUrls && act.imageUrls.length > 0) || act.imageUrl;

                return (
                  <tr key={act.id} onClick={() => navigate('/activity-form', { state: { editData: act, isViewMode: true } })} className="border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-colors group/row">
                    <td className="p-3 text-sm text-gray-700">{act.date}</td>
                    <td className="p-3 text-sm font-bold text-blue-600">{act.reportNo}</td>
                    <td className="p-3 text-sm">{groupInfo ? groupInfo.name : <span className="text-red-500">未登録</span>}</td>
                    <td className="p-3 text-sm text-gray-600">{act.location}</td>
                    <td className="p-3 text-sm font-bold text-gray-900">{act.activityType}</td>
                    <td className="p-3 text-center">
                      {hasImage ? <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded text-[10px] font-bold">あり</span> : <span className="text-gray-300 text-[10px]">なし</span>}
                    </td>
                    {canExport && (
                      <td className="p-3">
                        <div className="flex gap-1 justify-center">
                          <button onClick={(e) => { e.stopPropagation(); handleExportSingleReport(act); }} disabled={isThisExporting} className={`px-3 py-1.5 rounded-lg font-bold text-[10px] flex items-center transition-colors ${isThisExporting ? 'bg-blue-400 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>
                            <FileSpreadsheet size={14} className="mr-1" />Excel
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDirectPrint(act); }} className="px-3 py-1.5 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold text-[10px] flex items-center hover:bg-gray-50 transition-colors">
                            <Printer size={14} className="mr-1" />PDF
                          </button>
                        </div>
                      </td>
                    )}
                    {userRole === 'admin' && (
                      <td className="p-3 text-center">
                        <button onClick={(e) => handleDeleteClick(act.id, e)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 pb-20 md:pb-8 print:bg-white print:pb-0">
      <style>{`
        @media print {
          body { background: white !important; }
          @page { margin: 15mm; size: A4; }
          .no-print { display: none !important; }
        }
      `}</style>

      <header className="bg-white shadow-sm px-4 py-3 flex justify-between items-center sticky top-0 z-30 no-print">
        <div className="flex items-center">
          <Sprout className="w-8 h-8 mr-2 text-green-600" />
          <h1 className="text-lg font-bold text-gray-800">農事組合法人カマタ ERP</h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <button onClick={() => setActiveTab('home')} className={`flex items-center font-bold py-2 border-b-2 transition-colors ${activeTab === 'home' ? 'text-green-600 border-green-600' : 'text-gray-500 border-transparent hover:text-green-600'}`}>
            <Calendar size={18} className="mr-1.5"/> 活動一覧
          </button>
          {(userRole === 'admin' || userRole === 'manager') && (
            <button onClick={() => navigate('/groups')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600">
              <Users size={18} className="mr-1"/> グループ管理
            </button>
          )}
          {userRole === 'admin' && (
            <>
              <button onClick={() => navigate('/users')} className="flex items-center text-sm font-bold text-gray-500 hover:text-purple-600">
                <UserCog size={18} className="mr-1"/> ユーザー管理
              </button>
              <button onClick={() => navigate('/masters')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600">
                <Settings size={18} className="mr-1"/> マスタ管理
              </button>
            </>
          )}
          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <button onClick={handleLogout} className="flex items-center text-sm font-bold text-gray-500 hover:text-red-600">
            <LogOut size={18} className="mr-1"/> ログアウト
          </button>
        </div>

        <div className="md:hidden flex items-center space-x-3">
           {(userRole === 'admin' || userRole === 'manager') && (
            <button onClick={() => navigate('/groups')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Users size={20} /></button>
          )}
          {userRole === 'admin' && (
            <>
              <button onClick={() => navigate('/users')} className="p-2 text-gray-500 hover:text-purple-600 transition-colors"><UserCog size={20} /></button>
              <button onClick={() => navigate('/masters')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors"><Settings size={20} /></button>
            </>
          )}
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto no-print">
        <div className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-gray-600 text-sm">こんにちは、</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center">
              {currentUser?.displayName || 'ユーザー'} さん
              <span className="ml-2 text-[10px] bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-bold">権限: {roleLabel}</span>
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            
            <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
              <button onClick={() => setViewStyle('card')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStyle === 'card' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <LayoutGrid size={14} className="mr-1.5" /> 特大
              </button>
              <button onClick={() => setViewStyle('table')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewStyle === 'table' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <List size={14} className="mr-1.5" /> 詳細
              </button>
            </div>

            {(userRole === 'admin' || userRole === 'manager') && (
              <div className="bg-white border border-gray-200 rounded-xl p-1 flex shadow-sm">
                <button onClick={() => setDisplayMode('list')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${displayMode === 'list' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <LayoutList size={14} className="mr-1.5" /> 日付順
                </button>
                <button onClick={() => setDisplayMode('group')} className={`flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${displayMode === 'group' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <Layers size={14} className="mr-1.5" /> グループ別
                </button>
              </div>
            )}
            
            <button onClick={() => navigate('/bulk-activity')} className="flex items-center bg-blue-100 text-blue-700 border border-blue-200 px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-blue-200 active:scale-95 transition-all">
              <LayoutList size={18} className="mr-1.5" /> 一括計画
            </button>

            <button onClick={() => navigate('/activity-form')} className="flex items-center bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-green-700 active:scale-95 transition-all">
              <Plus size={18} className="mr-1.5" /> 新規報告
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">読み込み中...</div>
        ) : activities.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400 font-bold">
            表示できる実績がありません
          </div>
        ) : (
          <>
            {displayMode === 'list' && (
              <div className="animate-in fade-in duration-500">
                {viewStyle === 'card' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {globalSortedActivities.map(act => <ActivityCard key={act.id} activity={act} />)}
                  </div>
                ) : (
                  <ActivityTable activitiesToRender={globalSortedActivities} />
                )}
              </div>
            )}

            {displayMode === 'group' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {groupsList.map(group => {
                  const acts = groupedActivities[group.id] || [];
                  if (acts.length === 0) return null;
                  return (
                    <div key={group.id} className="space-y-4">
                      <div className="flex items-center">
                        <div className="h-6 w-1.5 bg-blue-600 rounded-full mr-3"></div>
                        <h3 className="text-lg font-extrabold text-gray-800">{group.name}</h3>
                        <span className="ml-3 bg-blue-50 text-blue-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-100">
                          {acts.length} 件の記録
                        </span>
                      </div>
                      
                      {viewStyle === 'card' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {acts.map(act => <ActivityCard key={act.id} activity={act} />)}
                        </div>
                      ) : (
                        <ActivityTable activitiesToRender={acts} />
                      )}
                    </div>
                  );
                })}

                {(() => {
                  const unregisteredActs = Object.keys(groupedActivities)
                    .filter(gid => !groupsList.some(g => g.id === gid))
                    .flatMap(gid => groupedActivities[gid])
                    .sort((a, b) => {
                      const dateA = new Date(a.date);
                      const dateB = new Date(b.date);
                      return dateSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
                    });

                  if (unregisteredActs.length === 0) return null;

                  return (
                    <div key="unregistered" className="space-y-4">
                      <div className="flex items-center">
                        <div className="h-6 w-1.5 bg-gray-400 rounded-full mr-3"></div>
                        <h3 className="text-lg font-extrabold text-gray-500">グループ未登録・不明</h3>
                        <span className="ml-3 bg-gray-100 text-gray-600 text-xs px-2.5 py-0.5 rounded-full font-bold border border-gray-200">
                          {unregisteredActs.length} 件の記録
                        </span>
                      </div>
                      
                      <div className="opacity-80">
                        {viewStyle === 'card' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {unregisteredActs.map(act => <ActivityCard key={act.id} activity={act} />)}
                          </div>
                        ) : (
                          <ActivityTable activitiesToRender={unregisteredActs} />
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </main>

      {deletingActivityId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setDeletingActivityId(null)}>
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">活動記録の削除</h3>
              <p className="text-sm text-gray-600">
                本当にこの活動記録を削除しますか？<br/>
                <span className="text-red-500 font-bold">※この操作は元に戻せません。</span>
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex space-x-3">
              <button onClick={() => setDeletingActivityId(null)} className="flex-1 py-2.5 bg-white border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors">
                キャンセル
              </button>
              <button onClick={executeDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center justify-center">
                <Trash2 size={18} className="mr-1.5" /> 削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {printActivity && (() => {
        const printImages = printActivity.imageUrls || (printActivity.imageUrl ? [printActivity.imageUrl] : []);
        const totalImages = printImages.length;
        const groupInfo = groupsList.find(g => g.id === printActivity.groupId);

        return (
          <div className="hidden print:block w-full text-black bg-white font-serif">
            <h1 className="text-2xl font-bold text-center border-b-4 border-black pb-2 mb-6">活動状況写真台帳</h1>
            <table className="w-full border-2 border-black border-collapse mb-6 text-sm">
              <tbody>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">報告書NO</th><td className="border border-black p-3" colSpan="3">{printActivity.reportNo || '（未設定）'}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">実施年月日</th><td className="border border-black p-3 w-1/4">{printActivity.date}</td><th className="border border-black bg-gray-100 p-3 w-1/4 text-left">活動項目番号</th><td className="border border-black p-3 w-1/4">{printActivity.activityNumbers?.join(', ')}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">実施場所</th><td className="border border-black p-3" colSpan="3">{printActivity.location}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">活動内容</th><td className="border border-black p-3" colSpan="3">{printActivity.activityType}</td></tr>
                <tr><th className="border border-black bg-gray-100 p-3 text-left">参加人数</th><td className="border border-black p-3" colSpan="3">計 {printActivity.participants} 名 （農業者：{printActivity.participantsAgri}名 ／ 農業者以外：{printActivity.participantsNonAgri}名）</td></tr>
              </tbody>
            </table>
            <div className="space-y-6">
              {printImages.map((img, idx) => (
                <div key={idx} className="break-inside-avoid"><div className="text-sm font-bold mb-1 text-left">{idx + 1}/{totalImages}枚目</div><div className="border border-gray-400 p-1"><img src={img} alt="" className="w-full h-auto max-h-[140mm] object-contain" /></div></div>
              ))}
            </div>
            <div className="mt-8 flex justify-between items-end border-t border-black pt-4">
              <div className="text-sm">組織名：{groupInfo ? groupInfo.name : '農事組合法人カマタ'}</div>
              <div className="text-sm text-right">出力日：{new Date().toLocaleDateString('ja-JP')}</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};