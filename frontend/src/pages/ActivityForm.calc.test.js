import { describe, test, expect } from '@jest/globals';

/**
 * ActivityForm.jsx 内部の計算ロジックをテスト用に再現した関数群
 * （将来的に utils に切り出すことを推奨）
 */

// 1. 基本の作業時間計算
const calculateBaseHours = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  let hours = (endH + endM / 60) - (startH + startM / 60);
  return hours > 0 ? hours : 0;
};

// 2. 農業者・農業者以外の人数カウント
const calculateSummary = (participantDetails, membersList) => {
  return participantDetails.reduce((acc, p) => {
    let isAgri = p.isAgri;
    if (isAgri === undefined) {
      const wId = p.wageId || p.memberId;
      if (wId && wId !== 'zero') {
        const wage = membersList.find(m => m.id === wId);
        isAgri = wage ? wage.isAgri : true; // デフォルトは true(農業者)
      } else {
        isAgri = true;
      }
    }
    if (isAgri) acc.agri += 1; else acc.nonAgri += 1;
    return acc;
  }, { agri: 0, nonAgri: 0 });
};

// 3. 人件費・機械費・資材費の計算
const calculateCosts = (participantDetails, materialDetails, membersList, machinesList, materialsList) => {
  let pCost = 0; let mCost = 0; let matCost = 0;
  
  participantDetails.forEach(detail => {
    const wId = detail.wageId || detail.memberId;
    if (wId && wId !== 'zero') {
      const wage = membersList.find(m => m.id === wId);
      if (wage) pCost += (detail.workTime || 0) * (wage.defaultWage || 0);
    }
    if (detail.machineId) {
      const machine = machinesList.find(m => m.id === detail.machineId);
      if (machine) mCost += (detail.machineTime || 0) * (machine.defaultPrice || 0);
    }
  });

  materialDetails.forEach(detail => {
    if (detail.materialId) {
      const mat = materialsList.find(m => m.id === detail.materialId);
      if (mat) matCost += (detail.quantity || 0) * (mat.defaultPrice || 0);
    }
  });

  return { totalPersonnelCost: pCost, totalMachineCost: mCost, totalMaterialCost: matCost };
};

// ==========================================
// ここからテストケース
// ==========================================

describe('ActivityForm 計算ロジックテスト', () => {
  
  // テスト用のダミーマスタデータ
  const mockMembersList = [
    { id: 'm1', name: '農業太郎', defaultWage: 1000, isAgri: true },
    { id: 'm2', name: '非農次郎', defaultWage: 1200, isAgri: false }
  ];
  const mockMachinesList = [
    { id: 'mac1', name: 'トラクター', defaultPrice: 2000 },
    { id: 'mac2', name: '草刈り機', defaultPrice: 500 }
  ];
  const mockMaterialsList = [
    { id: 'mat1', name: '肥料', defaultPrice: 300, unit: 'kg' },
    { id: 'mat2', name: '除草剤', defaultPrice: 1500, unit: '本' }
  ];

  describe('1. 基本の作業時間計算 (calculateBaseHours)', () => {
    test('正常な時間が計算できること (08:00〜10:00 = 2時間)', () => {
      expect(calculateBaseHours('08:00', '10:00')).toBe(2);
    });

    test('分単位が正しく小数点換算されること (08:30〜10:00 = 1.5時間)', () => {
      expect(calculateBaseHours('08:30', '10:00')).toBe(1.5);
    });

    test('開始と終了が逆転、または同じ場合は 0 になること', () => {
      expect(calculateBaseHours('10:00', '08:00')).toBe(0);
      expect(calculateBaseHours('09:00', '09:00')).toBe(0);
    });
  });

  describe('2. 参加者人数の集計 (calculateSummary)', () => {
    test('農業者と農業者以外が正しくカウントされること', () => {
      const participants = [
        { isAgri: true },
        { isAgri: true },
        { isAgri: false }
      ];
      const result = calculateSummary(participants, mockMembersList);
      expect(result.agri).toBe(2);
      expect(result.nonAgri).toBe(1);
    });

    test('isAgriが未定義の場合、選択されたマスタ情報から判定されること', () => {
      const participants = [
        { wageId: 'm1' }, // マスタ上は農業者
        { wageId: 'm2' }, // マスタ上は農業者以外
        { wageId: 'zero' } // 選択なし＝デフォルト農業者(true)になる仕様
      ];
      const result = calculateSummary(participants, mockMembersList);
      expect(result.agri).toBe(2);
      expect(result.nonAgri).toBe(1);
    });
  });

  describe('3. 各費用の計算 (calculateCosts)', () => {
    test('人件費が正しく計算されること (時間 × 単価)', () => {
      const participants = [
        { wageId: 'm1', workTime: 2 }, // 2h * 1000円 = 2000円
        { wageId: 'm2', workTime: 1.5 } // 1.5h * 1200円 = 1800円
      ];
      const result = calculateCosts(participants, [], mockMembersList, mockMachinesList, mockMaterialsList);
      expect(result.totalPersonnelCost).toBe(3800);
      expect(result.totalMachineCost).toBe(0);
      expect(result.totalMaterialCost).toBe(0);
    });

    test('単価「zero(0円)」が選択された場合、人件費は0円になること', () => {
      const participants = [
        { wageId: 'zero', workTime: 5 } // 0円
      ];
      const result = calculateCosts(participants, [], mockMembersList, mockMachinesList, mockMaterialsList);
      expect(result.totalPersonnelCost).toBe(0);
    });

    test('機械費が正しく計算されること (時間 × 利用料)', () => {
      const participants = [
        { machineId: 'mac1', machineTime: 2 }, // 2h * 2000円 = 4000円
        { machineId: 'mac2', machineTime: 3 }  // 3h * 500円 = 1500円
      ];
      const result = calculateCosts(participants, [], mockMembersList, mockMachinesList, mockMaterialsList);
      expect(result.totalPersonnelCost).toBe(0);
      expect(result.totalMachineCost).toBe(5500);
    });

    test('資材費が正しく計算されること (数量 × 単価)', () => {
      const materials = [
        { materialId: 'mat1', quantity: 10 }, // 10kg * 300円 = 3000円
        { materialId: 'mat2', quantity: 2 }   // 2本 * 1500円 = 3000円
      ];
      const result = calculateCosts([], materials, mockMembersList, mockMachinesList, mockMaterialsList);
      expect(result.totalMaterialCost).toBe(6000);
    });

    test('人件費・機械費・資材費の総合計が正しく計算されること', () => {
      const participants = [
        { wageId: 'm1', workTime: 2, machineId: 'mac1', machineTime: 1.5 } 
        // 人件費: 2 * 1000 = 2000, 機械費: 1.5 * 2000 = 3000
      ];
      const materials = [
        { materialId: 'mat1', quantity: 5 } // 資材費: 5 * 300 = 1500
      ];
      
      const result = calculateCosts(participants, materials, mockMembersList, mockMachinesList, mockMaterialsList);
      
      expect(result.totalPersonnelCost).toBe(2000);
      expect(result.totalMachineCost).toBe(3000);
      expect(result.totalMaterialCost).toBe(1500);
      
      const grandTotal = result.totalPersonnelCost + result.totalMachineCost + result.totalMaterialCost;
      expect(grandTotal).toBe(6500);
    });
  });
});