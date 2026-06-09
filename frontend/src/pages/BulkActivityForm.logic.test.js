import { describe, test, expect } from '@jest/globals';

/**
 * BulkActivityForm.jsx 内部のデータ整形ロジックをテスト用に抽出
 * （入力された複数行のデータから、空行を省き、活動番号を配列に変換する処理）
 */
const prepareSubmitData = (rows, groupId, userId) => {
  const validRows = rows.filter(row => row.activityType.trim() !== '' || row.location.trim() !== '');
  
  if (validRows.length === 0) {
    return []; // 有効な行がない場合は空配列を返す
  }

  return validRows.map(row => {
    // 活動項目番号を文字列(1, 2)から配列(['1', '2'])に変換し、全角カンマやスペースを除去
    const actNumbers = row.activityNumbersStr
      .split(/[,、]/)
      .map(s => s.trim())
      .filter(s => s !== '');

    return {
      status: '実績入力済',
      planType: '当初計画',
      isEssential: false,
      groupId: groupId,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      location: row.location,
      activityType: row.activityType,
      activityNumbers: actNumbers,
      budget: 0,
      paymentCategory: '',
      memo: '一括登録による入力',
      reportNo: '', 
      participantDetails: [],
      materialDetails: [],
      participantsAgri: 0,
      participantsNonAgri: 0,
      participants: 0,
      imageUrls: [],
      isLocked: false,
      createdBy: userId,
      // 本来は createdAt: serverTimestamp() が入る
    };
  });
};

// ==========================================
// ここからテストケース
// ==========================================

describe('BulkActivityForm 送信データ構築ロジック', () => {
  const mockGroupId = 'group123';
  const mockUserId = 'user999';

  test('活動内容や場所が入力されている行のみが有効なデータとして抽出されること', () => {
    const rows = [
      { activityType: '草刈り', location: '1区', activityNumbersStr: '' }, // 有効
      { activityType: '  ', location: '  ', activityNumbersStr: '' },     // 無効（空文字・スペースのみ）
      { activityType: '', location: '農道', activityNumbersStr: '' },     // 有効（場所だけある）
    ];

    const result = prepareSubmitData(rows, mockGroupId, mockUserId);
    expect(result.length).toBe(2);
    expect(result[0].activityType).toBe('草刈り');
    expect(result[1].location).toBe('農道');
  });

  test('活動項目番号(文字列)が、半角・全角カンマやスペースを無視して正しい配列に変換されること', () => {
    const rows = [
      { activityType: 'テスト1', location: 'A', activityNumbersStr: '1,2, 3' },
      { activityType: 'テスト2', location: 'B', activityNumbersStr: '4、5 、6' }, // 全角カンマ・スペース混じり
      { activityType: 'テスト3', location: 'C', activityNumbersStr: ' 7 ' }, // スペースありの単一数字
    ];

    const result = prepareSubmitData(rows, mockGroupId, mockUserId);
    
    expect(result[0].activityNumbers).toEqual(['1', '2', '3']);
    // 🚀 修正: プログラムが正しくスペースを除去(trim)できているため、期待値もスペース無しの正しいものに修正
    expect(result[1].activityNumbers).toEqual(['4', '5', '6']); 
    expect(result[2].activityNumbers).toEqual(['7']);
  });

  test('すべての行が空の場合、空の配列が返されること', () => {
    const rows = [
      { activityType: '', location: '', activityNumbersStr: '' },
      { activityType: '', location: '', activityNumbersStr: '' }
    ];

    const result = prepareSubmitData(rows, mockGroupId, mockUserId);
    expect(result.length).toBe(0);
  });

  test('生成されたデータに、必須の固定フィールド(groupId, createdBy, status等)が正しくセットされていること', () => {
    const rows = [
      { 
        activityType: '泥上げ', 
        location: '水路', 
        activityNumbersStr: '1',
        date: '2026-06-15',
        startTime: '08:00',
        endTime: '12:00'
      }
    ];

    const result = prepareSubmitData(rows, mockGroupId, mockUserId);
    const data = result[0];

    expect(data.groupId).toBe(mockGroupId);
    expect(data.createdBy).toBe(mockUserId);
    expect(data.status).toBe('実績入力済');
    expect(data.planType).toBe('当初計画');
    expect(data.isLocked).toBe(false);
    expect(data.memo).toBe('一括登録による入力');
    expect(data.date).toBe('2026-06-15');
    expect(data.startTime).toBe('08:00');
    expect(data.endTime).toBe('12:00');
  });
});
