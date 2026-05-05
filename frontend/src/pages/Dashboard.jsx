import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, CheckCircle, Plus, Settings, LogOut, Sprout, Users, MessageSquare, Trash2, X, MapPin, BarChart2, Activity, Printer, FileSpreadsheet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';

// =========================================================================
// マスターデータ
// =========================================================================
const MACHINES = [
  { id: "1", name: "刈払機（肩掛け）", defaultPrice: 1350 },
  { id: "2", name: "畦畔刈払機", defaultPrice: 1800 },
  { id: "3", name: "法面刈払機", defaultPrice: 2000 },
  { id: "4", name: "除草剤噴霧器", defaultPrice: 1350 },
  { id: "5", name: "軽トラック", defaultPrice: 1000 },
  { id: "6", name: "バックホー", defaultPrice: 3000 },
  { id: "7", name: "チェーンソー", defaultPrice: 1000 },
  { id: "8", name: "泥上げ", defaultPrice: 1050 },
];

export const Dashboard = () => {
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [printActivity, setPrintActivity] = useState(null);
  const [activeTab, setActiveTab] = useState('home');
  const [exportingId, setExportingId] = useState(null);
  const [membersList, setMembersList] = useState([]);
  
  // 🚀 グループマスターをデータベースから取得して格納するState
  const [groupsList, setGroupsList] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');
  const [userGroupIds, setUserGroupIds] = useState([]);

  useEffect(() => {
    // メンバー情報の読み込み
    fetch('/members.json')
      .then(res => res.json())
      .then(data => setMembersList(data))
      .catch(err => console.error("メンバー情報の読み込みに失敗しました:", err));

    // 🚀 グループ情報のリアルタイム読み込み
    const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const gData = [];
      snapshot.forEach(doc => gData.push({ id: doc.id, ...doc.data() }));
      setGroupsList(gData);
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
              const data = [];
              querySnapshot.forEach((doc) => {
                data.push({ id: doc.id, ...doc.data() });
              });
              data.sort((a, b) => new Date(b.date) - new Date(a.date));
              setActivities(data);
              setLoading(false);
            });
          });
          return; 
        }

        unsubscribeData = onSnapshot(q, (querySnapshot) => {
          const data = [];
          querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() });
          });
          data.sort((a, b) => new Date(b.date) - new Date(a.date));
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
      if (unsubscribeData) unsubscribeData();
    };
  }, []);

  const handleLogout = async () => {
    try { await signOut(auth); navigate('/'); } catch (error) { console.error(error); }
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
          const member = membersList.find(m => m.id === detail.memberId);
          const machine = MACHINES.find(m => m.id === detail.machineId);
          
          let memberTotal = 0;
          let machineTotal = 0;

          if (member) {
            memberTotal = detail.workTime * member.defaultWage;
            sheet2.cell(`A${row}`).value(member.name); 
            sheet2.cell(`F${row}`).value(member.id); 
            sheet2.cell(`G${row}`).value(detail.workTime); 
            sheet2.cell(`J${row}`).value('時間'); 
            sheet2.cell(`L${row}`).value(member.defaultWage); 
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
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error(error);
      alert('Excel作成エラー：publicフォルダに「様式1_活動報告書_農地維持支払.xlsx」があるか確認してください。');
    } finally {
      setExportingId(null);
    }
  };

  const handleDirectPrint = (activity) => {
    setPrintActivity(activity);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const summaryData = useMemo(() => {
    const totalActivities = activities.length;
    const totalParticipants = activities.reduce((sum, act) => sum + Number(act.participants || 0), 0);
    return { totalActivities, totalParticipants };
  }, [activities]);

  const roleLabel = userRole === 'admin' ? '管理者' : userRole === 'manager' ? '事務・役員' : '現場リーダー';

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
          <h1 className="text-lg font-bold text-gray-800">農地維持管理システム</h1>
        </div>
        
        <div className="hidden md:flex items-center space-x-6">
          <button onClick={() => setActiveTab('home')} className={`flex items-center font-bold py-2 border-b-2 transition-colors ${activeTab === 'home' ? 'text-green-600 border-green-600' : 'text-gray-500 border-transparent hover:text-green-600'}`}>
            <Calendar size={18} className="mr-1.5"/> 活動一覧
          </button>
          <button onClick={() => setActiveTab('summary')} className={`flex items-center font-bold py-2 border-b-2 transition-colors ${activeTab === 'summary' ? 'text-green-600 border-green-600' : 'text-gray-500 border-transparent hover:text-green-600'}`}>
            <BarChart2 size={18} className="mr-1.5"/> 集計サマリー
          </button>

          {(userRole === 'admin' || userRole === 'manager') && (
            <button onClick={() => navigate('/groups')} className="flex items-center text-sm font-bold text-gray-500 hover:text-blue-600 transition-colors">
              <Users size={18} className="mr-1"/> グループ管理
            </button>
          )}

          <div className="h-6 w-px bg-gray-300 mx-2"></div>
          <button onClick={handleLogout} className="flex items-center text-sm font-bold text-gray-500 hover:text-red-600 transition-colors">
            <LogOut size={18} className="mr-1"/> ログアウト
          </button>
        </div>

        <div className="md:hidden flex items-center space-x-3">
           {(userRole === 'admin' || userRole === 'manager') && (
            <button onClick={() => navigate('/groups')} className="p-2 text-gray-500 hover:text-blue-600 transition-colors">
              <Users size={20} />
            </button>
          )}
          <button onClick={handleLogout} className="p-2 text-gray-500 hover:text-red-600 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="p-4 max-w-md md:max-w-6xl mx-auto no-print">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <p className="text-gray-600 text-sm">こんにちは、</p>
            <h2 className="text-xl md:text-2xl font-bold text-gray-900">
              {currentUser?.displayName || 'ユーザー'} さん
              <span className="ml-2 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full font-normal">権限: {roleLabel}</span>
            </h2>
          </div>
          {activeTab === 'home' && (
            <button onClick={() => navigate('/activity-form')} className="hidden md:flex items-center bg-green-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-sm hover:bg-green-700 transition-colors">
              <Plus size={20} className="mr-2" /> 新規実績を報告
            </button>
          )}
        </div>

        {activeTab === 'home' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <button onClick={() => navigate('/activity-form')} className="md:hidden w-full mb-8 bg-white border-2 border-dashed border-gray-300 rounded-xl p-6 flex flex-col items-center justify-center hover:bg-green-50 transition-colors shadow-sm">
              <div className="bg-gray-100 p-3 rounded-full mb-2"><Plus className="h-6 w-6 text-gray-400" /></div>
              <span className="font-bold text-gray-600">活動実績を報告する</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {loading ? (
                <div className="text-center py-10 text-gray-400 col-span-full">読み込み中...</div>
              ) : activities.length === 0 ? (
                 <div className="text-center py-10 text-gray-400 col-span-full bg-white rounded-2xl shadow-sm border border-gray-100">
                   表示できる実績がありません
                 </div>
              ) : activities.map((activity) => {
                const images = activity.imageUrls || (activity.imageUrl ? [activity.imageUrl] : []);
                const isThisExporting = exportingId === activity.id;
                const canExport = userRole === 'admin' || userRole === 'manager';
                // 🚀 DBから取得した groupsList と照合
                const groupInfo = groupsList.find(g => g.id === activity.groupId);

                return (
                  <div key={activity.id} onClick={() => navigate('/activity-form', { state: { editData: activity, isViewMode: true } })} className="bg-white rounded-2xl shadow-sm border-l-4 border-green-500 p-4 cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all flex flex-col h-full group relative">
                    {groupInfo && (
                      <span className="absolute top-4 right-4 bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-bold">
                        {groupInfo.name}
                      </span>
                    )}

                    <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 mb-2 pr-20">{activity.activityType || '内容未入力'}</h3>
                    <div className="space-y-1.5 text-sm text-gray-600 mb-3 flex-grow">
                      {activity.reportNo && (
                        <div className="flex items-center text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-md w-max mb-1">
                          NO: {activity.reportNo}
                        </div>
                      )}
                      <div className="flex items-center"><Calendar className="mr-2 h-4 w-4" />{activity.date}</div>
                      <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" />{activity.location}</div>
                    </div>
                    {images.length > 0 && (
                      <div className="relative rounded-lg overflow-hidden h-40 md:h-48 bg-gray-50 border border-gray-100 mb-3">
                        <img src={images[0]} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    
                    {canExport && (
                      <div className="mt-auto pt-3 border-t border-gray-100 flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleExportSingleReport(activity); }}
                          disabled={isThisExporting}
                          className={`flex-1 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center transition-colors ${isThisExporting ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                        >
                          <FileSpreadsheet size={16} className="mr-1" />
                          {isThisExporting ? '生成中...' : 'Excel'}
                        </button>
                        
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDirectPrint(activity); }}
                          className="flex-1 bg-gray-50 text-gray-700 border border-gray-200 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center hover:bg-gray-100 transition-colors"
                        >
                          <Printer size={16} className="mr-1" /> PDF
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-around items-center z-20 pb-safe no-print">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center ${activeTab === 'home' ? 'text-green-600' : 'text-gray-400'}`}><Calendar size={24} /><span className="text-[10px] mt-1 font-bold">実績</span></button>
        <button onClick={() => setActiveTab('summary')} className={`flex flex-col items-center ${activeTab === 'summary' ? 'text-green-600' : 'text-gray-400'}`}><BarChart2 size={24} /><span className="text-[10px] mt-1 font-bold">集計</span></button>
      </nav>

      {/* 🖨️ 印刷用デザイン */}
      {printActivity && (() => {
        const printImages = printActivity.imageUrls || (printActivity.imageUrl ? [printActivity.imageUrl] : []);
        const totalImages = printImages.length;
        const groupInfo = groupsList.find(g => g.id === printActivity.groupId);

        return (
          <div className="hidden print:block w-full text-black bg-white font-serif">
            <h1 className="text-2xl font-bold text-center border-b-4 border-black pb-2 mb-6">活動状況写真台帳</h1>
            <table className="w-full border-2 border-black border-collapse mb-6 text-sm">
              <tbody>
                <tr>
                  <th className="border border-black bg-gray-100 p-3 w-1/4 text-left">報告書NO</th>
                  <td className="border border-black p-3" colSpan="3">{printActivity.reportNo || '（未設定）'}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-3 w-1/4 text-left">実施年月日</th>
                  <td className="border border-black p-3 w-1/4">{printActivity.date}</td>
                  <th className="border border-black bg-gray-100 p-3 w-1/4 text-left">活動項目番号</th>
                  <td className="border border-black p-3 w-1/4">{printActivity.activityNumbers?.join(', ')}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-3 text-left">実施場所</th>
                  <td className="border border-black p-3" colSpan="3">{printActivity.location}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-3 text-left">活動内容</th>
                  <td className="border border-black p-3" colSpan="3">{printActivity.activityType}</td>
                </tr>
                <tr>
                  <th className="border border-black bg-gray-100 p-3 text-left">参加人数</th>
                  <td className="border border-black p-3" colSpan="3">
                    計 {printActivity.participants} 名 （農業者：{printActivity.participantsAgri}名 ／ 農業者以外：{printActivity.participantsNonAgri}名）
                  </td>
                </tr>
              </tbody>
            </table>
            
            <div className="space-y-6">
              {printImages.map((img, idx) => (
                <div key={idx} className="break-inside-avoid">
                  <div className="text-sm font-bold mb-1 text-left">{idx + 1}/{totalImages}枚目</div>
                  <div className="border border-gray-400 p-1"><img src={img} alt="" className="w-full h-auto max-h-[140mm] object-contain" /></div>
                </div>
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