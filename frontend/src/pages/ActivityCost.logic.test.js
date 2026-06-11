import { describe, test, expect } from '@jest/globals';

/**
 * Dashboard.jsx および ActivityForm.jsx 内部の
 * 「活動実績の合計費用（人件費＋機械利用料＋資材費）を計算するロジック」を抽出
 */
const calculateActivityCost = (act, membersList, machinesList, materialsList) => {
  let pCost = 0; 
  let mCost = 0; 
  let matCost = 0;

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

  (act.materialDetails || []).forEach(detail => {
    if (detail.materialId) {
      const mat = materialsList.find(m => m.id === detail.materialId);
      if (mat) matCost += (detail.quantity || 0) * (mat.defaultPrice || 0);
    }
  });

  return pCost + mCost + matCost;
};

// ==========================================
// ここからテストケース
// ==========================================

describe('活動費用の計算ロジック (calculateActivityCost)', () => {
  // モック（テスト用）のマスタデータ
  const mockMembers = [
    { id: 'member1', name: '草刈 太郎', defaultWage: 1000 },
    { id: 'member2', name: '泥上 次郎', defaultWage: 1200 },
  ];
  
  const mockMachines = [
    { id: 'machine1', name: '草刈り機', defaultPrice: 500 },
    { id: 'machine2', name: 'トラクター', defaultPrice: 2000 },
  ];

  const mockMaterials = [
    { id: 'mat1', name: 'ゴミ袋', defaultPrice: 50 },
    { id: 'mat2', name: '砂利', defaultPrice: 3000 },
  ];

  test('人件費のみが正しく計算されること', () => {
    const activity = {
      participantDetails: [
        { wageId: 'member1', workTime: 2 }, // 1000円 * 2時間 = 2000円
        { wageId: 'member2', workTime: 1.5 } // 1200円 * 1.5時間 = 1800円
      ]
    };
    const result = calculateActivityCost(activity, mockMembers, mockMachines, mockMaterials);
    expect(result).toBe(3800); // 2000 + 1800
  });

  test('人件費と機械利用料が正しく合算されること', () => {
    const activity = {
      participantDetails: [
        { wageId: 'member1', workTime: 3, machineId: 'machine1', machineTime: 3 }, // 人(1000*3) + 機(500*3) = 4500
        { wageId: 'member2', workTime: 2, machineId: 'machine2', machineTime: 1 }  // 人(1200*2) + 機(2000*1) = 4400
      ]
    };
    const result = calculateActivityCost(activity, mockMembers, mockMachines, mockMaterials);
    expect(result).toBe(8900);
  });

  test('資材費のみが正しく計算されること', () => {
    const activity = {
      materialDetails: [
        { materialId: 'mat1', quantity: 10 }, // 50円 * 10個 = 500
        { materialId: 'mat2', quantity: 2 }   // 3000円 * 2個 = 6000
      ]
    };
    const result = calculateActivityCost(activity, mockMembers, mockMachines, mockMaterials);
    expect(result).toBe(6500);
  });

  test('人件費、機械利用料、資材費のすべてが正しく合算されること', () => {
    const activity = {
      participantDetails: [
        { wageId: 'member1', workTime: 1, machineId: 'machine1', machineTime: 1 }, // 1000 + 500 = 1500
      ],
      materialDetails: [
        { materialId: 'mat1', quantity: 5 }, // 50 * 5 = 250
      ]
    };
    const result = calculateActivityCost(activity, mockMembers, mockMachines, mockMaterials);
    expect(result).toBe(1750);
  });

  test('マスタに存在しない（削除された）IDが指定された場合、その費用は0円として無視されること', () => {
    const activity = {
      participantDetails: [
        { wageId: 'unknown_member', workTime: 5, machineId: 'unknown_machine', machineTime: 5 }, 
        { wageId: 'member1', workTime: 1 } // これだけ有効 1000 * 1 = 1000
      ],
      materialDetails: [
        { materialId: 'unknown_mat', quantity: 10 }
      ]
    };
    const result = calculateActivityCost(activity, mockMembers, mockMachines, mockMaterials);
    expect(result).toBe(1000);
  });

  test('参加者や資材のデータが空、または未定義の場合は0円になること', () => {
    const result1 = calculateActivityCost({}, mockMembers, mockMachines, mockMaterials);
    expect(result1).toBe(0);

    const result2 = calculateActivityCost({ participantDetails: [], materialDetails: [] }, mockMembers, mockMachines, mockMaterials);
    expect(result2).toBe(0);
  });
});
