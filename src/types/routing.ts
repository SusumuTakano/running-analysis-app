// ルーティング関連の型定義

export type AppRoute = 
  | '/'                    // 一般ユーザー用トップ
  | '/admin/login'         // 管理者ログイン
  | '/admin/dashboard';    // 管理画面

export type RouteContext = {
  currentRoute: AppRoute;
  navigateTo: (route: AppRoute) => void;
};
