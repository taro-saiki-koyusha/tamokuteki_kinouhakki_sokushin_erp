import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ArrowLeft, Plus, Trash2, Edit, X, Check, Tractor, DollarSign, Settings, Package } from 'lucide-react';
import { db } from '../firebase';

export const MasterManagement = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [members, setMembers] = useState([]);
  const [materials, setMaterials] = useState([]); // 🚀 資材マスタを追加
  const [activeTab, setActiveTab] = useState('members'); // 'members', 'machines', 'materials'

  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});

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
    return () => { unsubMembers(); unsubMachines(); unsubMaterials(); };
  }, []);

  const handleAdd = async (type) => {
    const colName = type === 'members' ? 'members' : type === 'machines' ? 'machines' : 'materials';
    
    let newData;
    if (type === 'members') newData = { name: '新規作業単価', defaultWage: 1350, isAgri: true };
    else if (type === 'machines') newData = { name: '新規機械', defaultPrice: 1000 };
    else newData = { name: '新規資材', defaultPrice: 500, unit: '個' }; // 🚀 資材用の初期データ（単位付き）
    
    try {
      const docRef = await addDoc(collection(db, colName), { ...newData, createdAt: serverTimestamp() });
      setEditingId(docRef.id);
      setEditData(newData);
    } catch (e) { 
      console.error(e);
      alert('追加に失敗しました。Firebaseのセキュリティルール（権限）を確認してください。\n' + e.message); 
    }
  };

  const handleUpdate = async (type, id) => {
    const colName = type === 'members' ? 'members' : type === 'machines' ? 'machines' : 'materials';
    try {
      await updateDoc(doc(db, colName, id), editData);
      setEditingId(null);
    } catch (e) { 
      console.error(e); 
      alert('更新に失敗しました。');
    }
  };

  const handleDelete = async (type, id, name) => {
    if (!window.confirm(`${name} を削除してもよろしいですか？`)) return;
    const colName = type === 'members' ? 'members' : type === 'machines' ? 'machines' : 'materials';
    try { 
      await deleteDoc(doc(db, colName, id)); 
    } catch (e) { 
      console.error(e); 
      alert('削除に失敗しました。');
    }
  };

  // 表示するリストの出し分け
  const currentList = activeTab === 'members' ? members : activeTab === 'machines' ? machines : materials;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          <Settings className="w-6 h-6 mr-2 text-blue-600" />
          単価・マスタ管理
        </h1>
      </header>

      <main className="p-4 max-w-5xl mx-auto">
        {/* 🚀 3つのタブに拡張 */}
        <div className="flex flex-col sm:flex-row bg-white p-1 rounded-xl border border-gray-200 mb-6 shadow-sm gap-1">
          <button onClick={() => setActiveTab('members')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'members' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
            <DollarSign size={18} className="mr-2" /> 作業単価・人件費
          </button>
          <button onClick={() => setActiveTab('machines')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'machines' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Tractor size={18} className="mr-2" /> 機械・利用料
          </button>
          <button onClick={() => setActiveTab('materials')} className={`flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center transition-all ${activeTab === 'materials' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
            <Package size={18} className="mr-2" /> 資材・材料費
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
            <h2 className="font-bold text-gray-700">
              {activeTab === 'members' ? '作業単価リスト' : activeTab === 'machines' ? '機械リスト' : '資材リスト'}
            </h2>
            <button onClick={() => handleAdd(activeTab)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-700 transition-colors">
              <Plus size={18} className="mr-1" /> 新規追加
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider border-b">
                  <th className="px-6 py-3 font-bold">名称</th>
                  <th className="px-6 py-3 font-bold">
                    {activeTab === 'members' ? '人件費単価' : activeTab === 'machines' ? '利用料単価' : '資材単価'}
                  </th>
                  {activeTab === 'members' && <th className="px-6 py-3 font-bold text-center">区分</th>}
                  <th className="px-6 py-3 font-bold text-center w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {currentList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      {editingId === item.id ? (
                        <input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="名称" />
                      ) : (
                        <span className="font-bold text-gray-800">{item.name}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === item.id ? (
                        <div className="flex items-center">
                          <span className="mr-1 text-gray-400">¥</span>
                          <input type="number" value={activeTab === 'members' ? editData.defaultWage : editData.defaultPrice} 
                            onChange={e => setEditData({...editData, [activeTab === 'members' ? 'defaultWage' : 'defaultPrice']: parseInt(e.target.value)})} 
                            className="w-24 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500" />
                          
                          {/* 🚀 資材の時だけ「単位」を入力可能にする */}
                          {activeTab === 'materials' && (
                            <>
                              <span className="mx-2 text-gray-400">/</span>
                              <input type="text" value={editData.unit || '個'} onChange={e => setEditData({...editData, unit: e.target.value})} className="w-16 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500" placeholder="単位" />
                            </>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-600 font-mono">
                          ¥{(activeTab === 'members' ? item.defaultWage : item.defaultPrice)?.toLocaleString() || 0}
                          {activeTab === 'materials' && ` / ${item.unit || '個'}`}
                        </span>
                      )}
                    </td>
                    {activeTab === 'members' && (
                      <td className="px-6 py-4 text-center">
                        {editingId === item.id ? (
                          <label className="inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={editData.isAgri} onChange={e => setEditData({...editData, isAgri: e.target.checked})} className="sr-only peer" />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ml-2 text-xs font-bold text-gray-500">{editData.isAgri ? '農業者' : '以外'}</span>
                          </label>
                        ) : (
                          <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${item.isAgri ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                            {item.isAgri ? '農業者' : '農業者以外'}
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="flex justify-center space-x-2">
                        {editingId === item.id ? (
                          <>
                            <button onClick={() => handleUpdate(activeTab, item.id)} className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"><Check size={18}/></button>
                            <button onClick={() => setEditingId(null)} className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"><X size={18}/></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => { setEditingId(item.id); setEditData(item); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit size={18}/></button>
                            <button onClick={() => handleDelete(activeTab, item.id, item.name)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-4 text-xs text-gray-400 text-center">※ ここでの変更は、今後の新規登録・修正分から適用されます。</p>
      </main>
    </div>
  );
};