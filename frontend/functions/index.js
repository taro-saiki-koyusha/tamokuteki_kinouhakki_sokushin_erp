const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();

// 東京リージョンで関数を定義 (Functions v2)
exports.deleteUser = onCall({ region: "asia-northeast1" }, async (request) => {
  // 1. 呼び出し元が認証されているかチェック
  if (!request.auth) {
    throw new HttpsError('unauthenticated', '認証されていません。');
  }

  const targetUid = request.data.uid;
  if (!targetUid) {
    throw new HttpsError('invalid-argument', '削除対象のユーザーIDが指定されていません。');
  }

  try {
    // 2. 実行者が「管理者(admin)」かどうかFirestoreで確認
    const callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'ユーザーを削除する権限がありません。');
    }

    // 3. Authentication (認証システム) からユーザーを削除
    await admin.auth().deleteUser(targetUid);

    // 4. Firestore (名簿データベース) からユーザーを削除
    await admin.firestore().collection('users').doc(targetUid).delete();

    return { message: `Successfully deleted user: ${targetUid}` };
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new HttpsError('internal', 'ユーザーの削除処理中にエラーが発生しました。', error);
  }
});