# WASABI MONEY 🥬

中央集権型のシフト希望回収・勤怠・給与管理システムです。
スマホでの操作に特化し、管理者の事務負担を最小限に抑えることを目的としています。

## 🚀 主な機能
- **シフト希望回収**: スタッフがスマホからカレンダー形式で希望を入力。
- **勤怠管理**: 管理者が現場で実績を確定（インセンティブ入力も可能）。
- **自動給与計算**: 月ごとの稼働時間と給与（UZS）をリアルタイム算出。
- **マルチ店舗対応**: 複数店舗のスタッフを一括管理。
- **セキュリティ**: スタッフごとのアクセスキーと管理者用マスターキーによる保護。

## 🛠 テクノロジー
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build Tool**: Vite
- **Backend**: Supabase (Database & Auth)
- **Deployment**: Vercel (推奨)

## 📦 セットアップ方法

1. リポジトリをクローン:
   ```bash
   git clone https://github.com/your-username/wasabi-money.git
   ```

2. 依存関係のインストール:
   ```bash
   npm install
   ```

3. 環境変数の設定:
   `.env.example` を `.env.local` にコピーし、SupabaseのURLとキーを入力してください。

4. 開発サーバーの起動:
   ```bash
   npm run dev
   ```

## 🔐 デフォルトパスワード
- **管理者モード**: `0306`
- **スタッフ初期パスワード**: `olma`
