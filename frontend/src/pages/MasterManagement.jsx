import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// 🚀 Timestamp を追加でインポート
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, setDoc, Timestamp } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Edit, X, Check, Tractor, DollarSign, Settings, Package, Calendar, CreditCard, Sprout } from 'lucide-react';
import { db } from '../firebase';

// 🚀 復元用の失われた4件のデータ
const RESTORE_DATA = [
  {
    "id": "Q72vKgwBLc1Lod5DqM84",
    "updatedAt": { "seconds": 1785411652, "nanoseconds": 849000000 },
    "endTime": "15:00",
    "systemMemo": "",
    "paymentDateId": "",
    "imageUrls": [
      "https://firebasestorage.googleapis.com/v0/b/tamokuteki-kinouhakki-erp.firebasestorage.app/o/photos%2F1783831329716_1000001270.jpg?alt=media&token=b02f41f6-a1f8-4f9f-9d74-94b2308a7f76",
      "https://firebasestorage.googleapis.com/v0/b/tamokuteki-kinouhakki-erp.firebasestorage.app/o/photos%2F1783831329730_1000001268.jpg?alt=media&token=c73ffdad-5f14-496a-a4d1-f88eebef2769",
      "https://firebasestorage.googleapis.com/v0/b/tamokuteki-kinouhakki-erp.firebasestorage.app/o/photos%2F1783831329735_1000001269.jpg?alt=media&token=73ac4ef5-d246-4586-9e19-03c9f87d7137"
    ],
    "memo": "",
    "createdAt": { "seconds": 1783831337, "nanoseconds": 664000000 },
    "participantsNonAgri": 0,
    "location": "七十刈池",
    "activityType": "七十刈池草刈り①",
    "participants": 2,
    "participantDetails": [
      {
        "isAgri": true,
        "machineId": "",
        "wageId": "5YRXAZojafv2nIQr5NDL",
        "participantName": "阿部賢二",
        "isManualName": false,
        "machineTime": 0,
        "workTime": 6
      },
      {
        "isManualName": false,
        "machineTime": 6,
        "wageId": "zero",
        "workTime": 0,
        "machineId": "sbk3iBMRv93xJCE3kEE1",
        "isAgri": true,
        "participantName": "農）カマタ"
      }
    ],
    "isLocked": false,
    "budget": 16500,
    "createdBy": "rEQzgOh4uZaV44YF75mb32F5UKg2",
    "startTime": "08:00",
    "reportNo": "20260712134217",
    "groupId": "nN0CprbF4pq3Stug1oB8",
    "participantsAgri": 2,
    "planType": "当初計画",
    "paymentCategory": "２ 資源向上支払（共同）",
    "updatedBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "activityNumbers": ["10", "13"],
    "isEssential": false,
    "date": "2026-07-11",
    "status": "未実施",
    "materialDetails": [],
    "customPaymentDate": ""
  },
  {
    "id": "mV8MKLCMZ2PYehFjCiFi",
    "isEssential": true,
    "materialDetails": [],
    "planType": "当初計画",
    "participantsNonAgri": 0,
    "paymentCategory": "２ 資源向上支払（共同）",
    "status": "未実施",
    "activityNumbers": ["5"],
    "date": "2026-07-25",
    "updatedBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "paymentDateId": "",
    "participantsAgri": 0,
    "startTime": "08:00",
    "participants": 0,
    "createdBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "endTime": "10:00",
    "reportNo": "20260601234732",
    "participantDetails": [],
    "memo": "【計画として一括登録】",
    "createdAt": { "seconds": 1778242239, "nanoseconds": 782000000 },
    "groupId": "nN0CprbF4pq3Stug1oB8",
    "activityType": "第1ポンプ場草刈り②",
    "updatedAt": { "seconds": 1780903719, "nanoseconds": 271000000 },
    "location": "その他",
    "imageUrls": [],
    "budget": 5400
  },
  {
    "id": "9uJhQXDJ71ljrAJRoxJ9",
    "memo": "【計画として一括登録】",
    "participantsNonAgri": 0,
    "activityNumbers": ["5"],
    "isEssential": true,
    "status": "未実施",
    "reportNo": "20260601234719",
    "paymentCategory": "２ 資源向上支払（共同）",
    "participantDetails": [],
    "materialDetails": [],
    "updatedBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "participantsAgri": 0,
    "location": "その他",
    "endTime": "10:00",
    "budget": 12150,
    "participants": 0,
    "createdBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "startTime": "08:00",
    "date": "2026-07-25",
    "updatedAt": { "seconds": 1780903711, "nanoseconds": 580000000 },
    "planType": "当初計画",
    "imageUrls": [],
    "createdAt": { "seconds": 1778242239, "nanoseconds": 797000000 },
    "activityType": "第2ポンプ場草刈り②",
    "groupId": "nN0CprbF4pq3Stug1oB8",
    "paymentDateId": ""
  },
  {
    "id": "scHtPIt4vvhFtyYb0Q1l",
    "activityType": "荒谷の沢池草刈り②",
    "imageUrls": [],
    "isEssential": true,
    "paymentCategory": "２ 資源向上支払（共同）",
    "location": "その他",
    "updatedAt": { "seconds": 1780903735, "nanoseconds": 281000000 },
    "budget": 8100,
    "activityNumbers": ["13", "15"],
    "createdAt": { "seconds": 1778242239, "nanoseconds": 732000000 },
    "date": "2026-08-01",
    "groupId": "nN0CprbF4pq3Stug1oB8",
    "endTime": "10:00",
    "reportNo": "20260601234746",
    "createdBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "materialDetails": [],
    "participants": 0,
    "startTime": "08:00",
    "participantsAgri": 0,
    "updatedBy": "H7RNPZ0UCTYZFIbmPaDSLAMaklr2",
    "status": "未実施",
    "memo": "【計画として一括登録】",
    "planType": "当初計画",
    "paymentDateId": "",
    "participantsNonAgri": 0,
    "participantDetails": []
  }
];

export const MasterManagement = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [members, setMembers] = useState([]);
  const [materials, setMaterials] = useState([]); 
  const [systemSettings, setSystemSettings] = useState({ 
    fiscalYearStartMonth: 4,
    targetYear: new Date().getFullYear(),
    paymentDates: [],
    budgetAgriMaintain: 0,
    budgetResourceJoint: 0,
    budgetResourceLongLife: 0,
    defaultStatus: '実績入力済', 
    defaultPlanType: '当初計画', 
    defaultWageId: ''           
  }); 
  
  const [activeTab, setActiveTab] = useState('members'); 

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    const unsubMembers = onSnapshot(query(collection(db, 'members'), orderBy('name')), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMachines = onSnapshot(query(collection(db, 'machines'), orderBy('name')), (snapshot) => {
      setMachines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    const unsubMaterials = onSnapshot(query(collection(db, 'materials'), orderBy('name')), (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSystemSettings({
          fiscalYearStartMonth: data.fiscalYearStartMonth || 4,
          targetYear: data.targetYear || new Date().getFullYear(),
          paymentDates: data.paymentDates || [],
          budgetAgriMaintain: data.budgetAgriMaintain || 0,
          budgetResourceJoint: data.budgetResourceJoint || 0,
          budgetResourceLongLife: data.budgetResourceLongLife || 0,
          defaultStatus: data.defaultStatus || '実績入力済',
          defaultPlanType: data.defaultPlanType || '当初計画',
          defaultWageId: data.defaultWageId || ''
        });
      }
    });

    return () => {
      unsubMembers();
      unsubMachines();
      unsubMaterials();
      unsubSettings(); 
    };
  }, []);

  // 🚀 復元実行関数
  const executeRestore = async () => {
    if(!window.confirm('失われた4件の活動データを復元します。よろしいですか？')) return;
    
    try {
      for (const act of RESTORE_DATA) {
        const dataToSave = { ...act };
        const docId = dataToSave.id;
        delete dataToSave.id;

        // 時間データ (seconds, nanoseconds) をFirestoreのTimestamp型に変換
        if (dataToSave.createdAt?.seconds) {
          dataToSave.createdAt = new Timestamp(dataToSave.createdAt.seconds, dataToSave.createdAt.nanoseconds);
        }
        if (dataToSave.updatedAt?.seconds) {
          dataToSave.updatedAt = new Timestamp(dataToSave.updatedAt.seconds, dataToSave.updatedAt.nanoseconds);
        }

        // setDocでIDを指定して上書き保存（復元）
        await setDoc(doc(db, 'activities', docId), dataToSave);
      }
      alert('4件の活動データを正常に復元しました！ダッシュボードを確認してください。');
    } catch (error) {
      console.error('復元エラー:', error);
      alert('エラーが発生しました。コンソールを確認してください。');
    }
  };

  const handleAdd = async (type) => {
    try {
      const collectionRef = collection(db, type);
      const newData = {
        name: `新しい${type === 'members' ? 'メンバー' : type === 'machines' ? '機械' : '資材'}`,
        createdAt: serverTimestamp()
      };
      
      if (type === 'members') {
        newData.defaultWage = 0;
        newData.isAgri = true;
      } else if (type === 'machines') {
        newData.defaultPrice = 0;
      } else if (type === 'materials') {
        newData.defaultPrice = 0;
        newData.unit = '個';
      }

      await addDoc(collectionRef, newData);
    } catch (error) {
      console.error("エラー:", error);
      alert('追加に失敗しました');
    }
  };

  const handleUpdate = async (type, id) => {
    try {
      await updateDoc(doc(db, type, id), {
        ...editData,
        updatedAt: serverTimestamp()
      });
      setEditingId(null);
      setEditData({});
    } catch (error) {
      console.error("エラー:", error);
      alert('更新に失敗しました');
    }
  };

  const handleDelete = async (type, id, name) => {
    if (window.confirm(`${name} を削除しますか？\n（※過去の実績データには影響しません）`)) {
      try {
        await deleteDoc(doc(db, type, id));
      } catch (error) {
        console.error("エラー:", error);
        alert('削除に失敗しました');
      }
    }
  };

  const handleAddPaymentDate = () => {
    setSystemSettings({
      ...systemSettings,
      paymentDates: [...systemSettings.paymentDates, { id: Date.now().toString(), label: '', date: '' }]
    });
  };

  const handleUpdatePaymentDate = (index, field, value) => {
    const newDates = [...systemSettings.paymentDates];
    newDates[index][field] = value;
    setSystemSettings({ ...systemSettings, paymentDates: newDates });
  };

  const handleRemovePaymentDate = (index) => {
    const newDates = systemSettings.paymentDates.filter((_, i) => i !== index);
    setSystemSettings({ ...systemSettings, paymentDates: newDates });
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), {
        fiscalYearStartMonth: Number(systemSettings.fiscalYearStartMonth),
        targetYear: Number(systemSettings.targetYear),
        paymentDates: systemSettings.paymentDates, 
        budgetAgriMaintain: Number(systemSettings.budgetAgriMaintain || 0),
        budgetResourceJoint: Number(systemSettings.budgetResourceJoint || 0),
        budgetResourceLongLife: Number(systemSettings.budgetResourceLongLife || 0),
        defaultStatus: systemSettings.defaultStatus || '実績入力済',
        defaultPlanType: systemSettings.defaultPlanType || '当初計画',
        defaultWageId: systemSettings.defaultWageId || '',
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert('システム設定を保存しました。');
    } catch (error) {
      console.error("設定保存エラー:", error);
      alert('設定の保存に失敗しました。');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const getTabData = () => {
    if (activeTab === 'members') return { data: members, title: 'メンバー・単価', icon: <DollarSign size={20} className="mr-2" /> };
    if (activeTab === 'machines') return { data: machines, title: '機械・利用料', icon: <Tractor size={20} className="mr-2" /> };
    if (activeTab === 'materials') return { data: materials, title: '資材・単価', icon: <Package size={20} className="mr-2" /> };
    return { data: [], title: 'システム設定', icon: <Settings size={20} className="mr-2" /> }; 
  };

  const { data: currentData, title, icon } = getTabData();
  const inputClass = "w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 text-sm";

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-bold text-gray-800 flex items-center">
          <Settings className="w-6 h-6 mr-2 text-blue-600" />
          マスタ・設定管理
        </h1>

        {/* 🚀 復元ボタンを右上に設置 */}
        <button 
          onClick={executeRestore}
          className="ml-auto bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-red-700 transition-colors shadow-sm active:scale-95"
        >
          失われた4件を復元
        </button>
      </header>

      <main className="p-4 max-w-5xl mx-auto space-y-6">
        
        <div className="bg-white rounded-xl shadow-sm p-1 inline-flex overflow-x-auto w-full md:w-auto">
          <button onClick={() => { setActiveTab('members'); setEditingId(null); }} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'members' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            メンバー単価
          </button>
          <button onClick={() => { setActiveTab('machines'); setEditingId(null); }} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'machines' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            機械利用料
          </button>
          <button onClick={() => { setActiveTab('materials'); setEditingId(null); }} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'materials' ? 'bg-blue-600 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            資材単価
          </button>
          <button onClick={() => { setActiveTab('settings'); setEditingId(null); }} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'settings' ? 'bg-gray-800 text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
            システム設定
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-bold text-gray-800 flex items-center">{icon} {title}</h2>
            {activeTab !== 'settings' && (
              <button onClick={() => handleAdd(activeTab)} className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm">
                <Plus size={16} className="mr-1" /> 新規追加
              </button>
            )}
          </div>

          {activeTab === 'settings' ? (
            <div className="p-6 space-y-8">
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
                <h3 className="font-bold text-blue-900 flex items-center mb-4 border-b border-blue-200 pb-2">
                  <Calendar className="w-5 h-5 mr-2" /> 事業年度の基本設定
                </h3>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <label className="text-sm font-bold text-gray-700 min-w-[150px]">年度の開始月</label>
                  <select 
                    value={systemSettings.fiscalYearStartMonth || 4} 
                    onChange={(e) => setSystemSettings({ ...systemSettings, fiscalYearStartMonth: Number(e.target.value) })}
                    className="w-full sm:w-48 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => (
                      <option key={month} value={month}>{month}月 開始</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">※ この月を起点として、ダッシュボードや実績一覧の「年度」が自動計算されます。</p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-5">
                  <label className="text-sm font-bold text-gray-700 min-w-[150px]">対象年度（西暦）</label>
                  <div className="flex items-center w-full sm:w-48">
                    <input 
                      type="number" 
                      value={systemSettings.targetYear} 
                      onChange={(e) => setSystemSettings({ ...systemSettings, targetYear: Number(e.target.value) })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 font-bold bg-white text-right"
                    />
                    <span className="ml-2 text-sm text-gray-600 font-bold">年</span>
                  </div>
                  <p className="text-xs text-gray-500">※ 支払明細書に出力される「令和〇年度」の基準となります。（例: 2026年 → 令和8年度）</p>
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-5">
                <h3 className="font-bold text-green-900 flex items-center mb-4 border-b border-green-200 pb-2">
                  <DollarSign className="w-5 h-5 mr-2" /> 本年度の支払区分別予算設定
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="text-sm font-bold text-gray-700 min-w-[240px]">１ 農地維持支払 予算</label>
                    <div className="flex items-center w-full sm:w-64">
                      <span className="text-gray-500 mr-2 font-bold">¥</span>
                      <input 
                        type="number" 
                        value={systemSettings.budgetAgriMaintain || 0} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, budgetAgriMaintain: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-right font-bold font-mono text-sm focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="text-sm font-bold text-gray-700 min-w-[240px]">２ 資源向上支払（共同） 予算</label>
                    <div className="flex items-center w-full sm:w-64">
                      <span className="text-gray-500 mr-2 font-bold">¥</span>
                      <input 
                        type="number" 
                        value={systemSettings.budgetResourceJoint || 0} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, budgetResourceJoint: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-right font-bold font-mono text-sm focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <label className="text-sm font-bold text-gray-700 min-w-[240px]">３ 資源向上支払（長寿命化） 予算</label>
                    <div className="flex items-center w-full sm:w-64">
                      <span className="text-gray-500 mr-2 font-bold">¥</span>
                      <input 
                        type="number" 
                        value={systemSettings.budgetResourceLongLife || 0} 
                        onChange={(e) => setSystemSettings({ ...systemSettings, budgetResourceLongLife: Number(e.target.value) })}
                        className="w-full border border-gray-300 rounded-lg p-2 text-right font-bold font-mono text-sm focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3">※ ここで設定した全体の総予算額枠が、ダッシュボードの「支払区分別の集計状況」に反映されます。</p>
              </div>

              <div className="bg-purple-50 border border-purple-100 rounded-xl p-5">
                <div className="flex justify-between items-center mb-4 border-b border-purple-200 pb-2">
                  <h3 className="font-bold text-purple-900 flex items-center">
                    <CreditCard className="w-5 h-5 mr-2" /> 振込日（申請時期）の設定
                  </h3>
                  <button 
                    onClick={handleAddPaymentDate}
                    className="text-sm font-bold text-purple-600 bg-white border border-purple-200 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors flex items-center shadow-sm"
                  >
                    <Plus size={16} className="mr-1" /> 追加
                  </button>
                </div>
                
                <div className="space-y-3">
                  {systemSettings.paymentDates.length === 0 ? (
                    <p className="text-sm text-purple-600/70 text-center py-4">振込日が設定されていません。「追加」ボタンから登録してください。</p>
                  ) : (
                    systemSettings.paymentDates.map((payment, index) => (
                      <div key={payment.id} className="flex flex-col sm:flex-row gap-3 bg-white p-3 rounded-xl border border-purple-100 shadow-sm items-center relative group">
                        <div className="flex-1 w-full sm:w-auto">
                          <label className="block text-xs font-bold text-gray-500 mb-1">振込名称（例: 上期分, 8月末など）</label>
                          <input 
                            type="text" 
                            value={payment.label} 
                            onChange={(e) => handleUpdatePaymentDate(index, 'label', e.target.value)}
                            placeholder="例：上期支払分"
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                        </div>
                        <div className="w-full sm:w-48">
                          <label className="block text-xs font-bold text-gray-500 mb-1">振込日（目安）</label>
                          <input 
                            type="date" 
                            value={payment.date} 
                            onChange={(e) => handleUpdatePaymentDate(index, 'date', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-purple-500 text-sm"
                          />
                        </div>
                        <button 
                          onClick={() => handleRemovePaymentDate(index)}
                          className="sm:mt-5 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <p className="text-xs text-purple-600/80 mt-4">※ ここで設定した振込日が、活動実績の入力画面で選択できるようになります。</p>
              </div>

              <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-4 flex items-center border-b border-blue-200 pb-2">
                  <Sprout className="w-5 h-5 mr-2" /> 活動実績のデフォルト値設定
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-blue-800 mb-1">状態の初期値</label>
                    <select
                      value={systemSettings.defaultStatus || '実績入力済'}
                      onChange={(e) => setSystemSettings({...systemSettings, defaultStatus: e.target.value})}
                      className="w-full box-border border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                    >
                      <option value="未実施">未実施</option>
                      <option value="実績入力済">実績入力済（作業完了）</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-blue-800 mb-1">計画区分の初期値</label>
                    <select
                      value={systemSettings.defaultPlanType || '当初計画'}
                      onChange={(e) => setSystemSettings({...systemSettings, defaultPlanType: e.target.value})}
                      className="w-full box-border border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                    >
                      <option value="当初計画">当初計画</option>
                      <option value="期中追加">期中追加</option>
                      <option value="突発・緊急">突発・緊急</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-blue-800 mb-1">参加者単価の初期値</label>
                    <select
                      value={systemSettings.defaultWageId || ''}
                      onChange={(e) => setSystemSettings({...systemSettings, defaultWageId: e.target.value})}
                      className="w-full box-border border border-blue-200 rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 bg-white font-bold"
                    >
                      <option value="">（選択なし）</option>
                      <option value="zero">単価選択なし (0円)</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-blue-700 mt-3 font-bold">
                  ※ 新規で活動実績を入力する際、ここで設定した値が最初から選択された状態になります。
                </p>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button 
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings}
                  className="px-6 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-900 transition-all flex items-center shadow-md active:scale-95 disabled:opacity-50"
                >
                  {isSavingSettings ? '保存中...' : <><Check size={18} className="mr-2" /> 全ての設定を保存する</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200 text-sm text-gray-600">
                    <th className="p-4 font-bold w-1/3">名称</th>
                    {activeTab === 'members' && <th className="p-4 font-bold text-center w-24">農業者区分</th>}
                    <th className="p-4 font-bold text-right w-32">基本単価</th>
                    {activeTab === 'materials' && <th className="p-4 font-bold text-center w-24">単位</th>}
                    <th className="p-4 font-bold text-center w-28">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {currentData.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        {editingId === item.id ? (
                          <input type="text" value={editData.name} onChange={(e) => setEditData({...editData, name: e.target.value})} className={inputClass} autoFocus />
                        ) : (
                          <span className="font-bold text-gray-800">{item.name}</span>
                        )}
                      </td>
                      {activeTab === 'members' && (
                        <td className="p-4 text-center">
                          {editingId === item.id ? (
                            <select value={editData.isAgri ? 'true' : 'false'} onChange={(e) => setEditData({...editData, isAgri: e.target.value === 'true'})} className={inputClass}>
                              <option value="true">農業者</option>
                              <option value="false">以外</option>
                            </select>
                          ) : (
                            <span className={`text-[10px] px-2 py-1 rounded font-bold ${item.isAgri ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                              {item.isAgri ? '農業者' : '以外'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        {editingId === item.id ? (
                          <div className="flex items-center justify-end">
                            <input 
                              type="number" 
                              value={activeTab === 'members' ? editData.defaultWage : activeTab === 'machines' ? editData.defaultPrice : editData.defaultPrice} 
                              onChange={(e) => setEditData({...editData, [activeTab === 'members' ? 'defaultWage' : 'defaultPrice']: Number(e.target.value)})} 
                              className={`${inputClass} text-right w-24`} 
                              step="50" 
                            />
                            <span className="ml-2 text-sm text-gray-500">円</span>
                          </div>
                        ) : (
                          <div className="text-right font-mono font-bold text-gray-700">
                            ¥{(activeTab === 'members' ? item.defaultWage : activeTab === 'machines' ? item.defaultPrice : item.defaultPrice)?.toLocaleString() || 0}
                          </div>
                        )}
                      </td>
                      {activeTab === 'materials' && (
                        <td className="p-4 text-center">
                          {editingId === item.id ? (
                            <input type="text" value={editData.unit || ''} onChange={(e) => setEditData({...editData, unit: e.target.value})} className={`${inputClass} text-center`} placeholder="例: 個, kg" />
                          ) : (
                            <span className="text-sm font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {item.unit || '個'}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="p-4">
                        <div className="flex justify-center space-x-2">
                          {editingId === item.id ? (
                            <>
                              <button onClick={() => handleUpdate(activeTab, item.id)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors" title="保存"><Check size={18}/></button>
                              <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors" title="キャンセル"><X size={18}/></button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => { setEditingId(item.id); setEditData(item); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="編集"><Edit size={18}/></button>
                              <button onClick={() => handleDelete(activeTab, item.id, item.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="削除"><Trash2 size={18}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {activeTab !== 'settings' && (
          <p className="mt-4 text-xs text-gray-400 text-center font-bold">※ ここでの変更は、今後の新規登録・修正分から適用されます。</p>
        )}
      </main>
    </div>
  );
};

export default MasterManagement;