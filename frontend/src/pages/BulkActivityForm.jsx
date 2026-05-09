import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Plus, Trash2, Calendar, LayoutList, Info, Loader2 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth } from '../firebase'; 

export const BulkActivityForm = () => {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // ユーザー権限とグループ情報
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState('reporter');
  const [groupsList, setGroupsList] = useState([]);
  const [userGroups, setUserGroups] = useState([]);

  // 対象グループ（一括登録の対象）
  const [selectedGroupId, setSelectedGroupId] = useState('');

  // 表の行データ（初期状態で3行用意）
  const createEmptyRow = () => ({
    id: Date.now() + Math.random(),
    date: new Date().toISOString().split('T')[0],
    startTime: '08:00',
    endTime: '10:00',
    location: '',
    activityNumbersStr: '', // "1, 5" のようにカンマ区切りで入力させる
    activityType: '',
  });

  const [rows, setRows] = useState([createEmptyRow(), createEmptyRow(), createEmptyRow()]);

  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroupsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserRole(data.role || 'reporter');
          const groups = data.groupIds || [];
          setUserGroups(groups);
          if (groups.length > 0) setSelectedGroupId(groups[0]);
        }
      }
    });

    return () => { unsubGroups(); unsubAuth(); };
  }, []);

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const addRow = () => setRows([...rows, createEmptyRow()]);
  const removeRow = (index) => setRows(rows.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGroupId) { alert('対象グループを選択してください。'); return; }
    
    // 入力がある行だけを抽出（日付と活動内容が入力されているものを有効とみなす）
    const validRows = rows.filter(row => row.date && row.activityType.trim() !== '');
    
    if (validRows.length === 0) { alert('登録する活動計画を1件以上入力してください。'); return; }

    setIsSubmitting(true);
    try {
      const promises = validRows.map(row => {
        // "1, 2, 3" という文字列を ["1", "2", "3"] の配列に変換
        const numbersArray = row.activityNumbersStr
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '');

        const submitData = {
          status: '未実施',
          groupId: selectedGroupId,
          date: row.date,
          startTime: row.startTime,
          endTime: row.endTime,
          location: row.location,
          activityNumbers: numbersArray,
          activityType: row.activityType,
          memo: '【計画として一括登録】', // 計画として登録されたことがわかるようにメモ
          reportNo: '',
          participantDetails: [], // 後から追加できるように空配列を用意
          participantsAgri: 0,
          participantsNonAgri: 0,
          participants: 0,
          imageUrls: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: currentUser?.uid
        };
        return addDoc(collection(db, 'activities'), submitData);
      });

      await Promise.all(promises);
      alert(`${validRows.length}件の活動計画を登録しました！`);
      navigate('/dashboard');
    } catch (error) {
      console.error(error);
      alert('保存エラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectableGroups = (userRole === 'admin' || userRole === 'manager') 
    ? groupsList 
    : groupsList.filter(g => userGroups.includes(g.id));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-12">
      {isSubmitting && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
          <p className="text-blue-800 font-bold text-lg tracking-wider">一括登録しています...</p>
        </div>
      )}

      <header className="bg-white shadow-sm px-4 py-3 flex items-center sticky top-0 z-30">
        <button onClick={() => navigate('/dashboard')} className="mr-4 text-gray-500 hover:text-gray-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex items-center">
          <LayoutList className="w-6 h-6 mr-2 text-green-600" />
          活動計画の一括登録
        </h1>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start">
          <Info className="w-5 h-5 text-blue-500 mr-2 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            年度当初の計画など、複数の活動を一気に登録する画面です。<br/>
            ここで登録したデータは、作業当日にダッシュボードからクリックして「参加者」や「写真」を追加することで、実績として完成します。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <label className="block text-sm font-bold text-gray-700 mb-2">対象グループ <span className="text-red-500">*</span></label>
            <select 
              value={selectedGroupId} 
              onChange={(e) => setSelectedGroupId(e.target.value)} 
              className="w-full md:w-1/3 border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-green-500" 
              required
            >
              <option value="">グループを選択してください</option>
              {selectableGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-sm text-gray-700">
                    <th className="p-3 font-bold w-32">日付</th>
                    <th className="p-3 font-bold w-40">開始 - 終了</th>
                    <th className="p-3 font-bold w-48">活動場所</th>
                    <th className="p-3 font-bold w-32">項目番号<br/><span className="text-[10px] font-normal text-gray-500">例: 1, 5, 12</span></th>
                    <th className="p-3 font-bold">具体的な活動内容 (入力必須)</th>
                    <th className="p-3 font-bold w-12 text-center">削除</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-2">
                        <input type="date" value={row.date} onChange={e => handleRowChange(index, 'date', e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm" />
                      </td>
                      <td className="p-2 flex items-center space-x-1">
                        <input type="time" value={row.startTime} onChange={e => handleRowChange(index, 'startTime', e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm" />
                        <span className="text-gray-400">-</span>
                        <input type="time" value={row.endTime} onChange={e => handleRowChange(index, 'endTime', e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm" />
                      </td>
                      <td className="p-2">
                        <select value={row.location} onChange={e => handleRowChange(index, 'location', e.target.value)} className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm">
                          <option value="">選択...</option>
                          <option value="鎌田排水機場用地">鎌田排水機場用地</option>
                          <option value="内郷地区水路">内郷地区水路</option>
                          <option value="その他">その他</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.activityNumbersStr} onChange={e => handleRowChange(index, 'activityNumbersStr', e.target.value)} placeholder="1, 5" className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm" />
                      </td>
                      <td className="p-2">
                        <input type="text" value={row.activityType} onChange={e => handleRowChange(index, 'activityType', e.target.value)} placeholder="例：内郷地区の草刈り" className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm" />
                      </td>
                      <td className="p-2 text-center">
                        <button type="button" onClick={() => removeRow(index)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-gray-50 border-t border-gray-100">
              <button type="button" onClick={addRow} className="flex items-center text-sm font-bold text-green-600 hover:text-green-700 bg-green-50 px-4 py-2 rounded-lg transition-colors">
                <Plus size={16} className="mr-1" /> 行を追加する
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button type="submit" disabled={isSubmitting} className="flex items-center justify-center py-4 px-10 rounded-2xl shadow-lg text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200 active:scale-95 transition-all disabled:opacity-50">
              <Save className="mr-2 h-6 w-6" />
              {isSubmitting ? '保存中...' : '計画を一括登録する'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};