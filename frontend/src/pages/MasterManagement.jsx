import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, setDoc } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Edit, X, Check, Tractor, DollarSign, Settings, Package, Calendar, CreditCard } from 'lucide-react';
import { db } from '../firebase';

export const MasterManagement = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [members, setMembers] = useState([]);
  const [materials, setMaterials] = useState([]); 
  const [systemSettings, setSystemSettings] = useState({ 
    fiscalYearStartMonth: 4,
    paymentDates: [],
    budgetAgriMaintain: 0,
    budgetResourceJoint: 0,
    budgetResourceLongLife: 0
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
          paymentDates: data.paymentDates || [],
          budgetAgriMaintain: data.budgetAgriMaintain || 0,
          budgetResourceJoint: data.budgetResourceJoint || 0,
          budgetResourceLongLife: data.budgetResourceLongLife || 0
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
        paymentDates: systemSettings.paymentDates, 
        budgetAgriMaintain: Number(systemSettings.budgetAgriMaintain || 0),
        budgetResourceJoint: Number(systemSettings.budgetResourceJoint || 0),
        budgetResourceLongLife: Number(systemSettings.budgetResourceLongLife || 0),
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
              </div>

              {/* 🚀 新規追加：支払区分別の予算枠設定 */}
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
