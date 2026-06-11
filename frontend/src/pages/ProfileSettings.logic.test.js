import { describe, test, expect } from '@jest/globals';

/**
 * ProfileSettings.jsx 等で使われている、
 * 電話番号入力時の全角→半角変換および数字以外の除去ロジック
 */
const formatPhoneNumber = (value) => {
  if (!value) return '';
  return value
    // 全角数字を半角数字に変換
    .replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    // 数字(0-9)以外の文字をすべて削除
    .replace(/[^0-9]/g, '');
};

// ==========================================
// ここからテストケース
// ==========================================

describe('電話番号フォーマットロジック (formatPhoneNumber)', () => {
  
  test('ハイフンが含まれている場合、ハイフンが除去されること', () => {
    expect(formatPhoneNumber('090-1234-5678')).toBe('09012345678');
  });

  test('全角数字で入力された場合、半角数字に変換されること', () => {
    expect(formatPhoneNumber('０９０１２３４５６７８')).toBe('09012345678');
  });

  test('全角数字とハイフンが混ざっている場合、正しく半角数字のみになること', () => {
    expect(formatPhoneNumber('０９０ー１２３４ー５６７８')).toBe('09012345678');
  });

  test('スペースや括弧など、数字以外の記号が除去されること', () => {
    expect(formatPhoneNumber('090 (1234) 5678')).toBe('09012345678');
    expect(formatPhoneNumber('090 1234 5678')).toBe('09012345678');
  });

  test('アルファベットやひらがななどの文字が除去されること', () => {
    expect(formatPhoneNumber('090abcd1234あいう')).toBe('0901234');
  });

  test('空文字や未定義が渡された場合、空文字を返すこと', () => {
    expect(formatPhoneNumber('')).toBe('');
    expect(formatPhoneNumber(null)).toBe('');
    expect(formatPhoneNumber(undefined)).toBe('');
  });
});
