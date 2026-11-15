export const routes = [
  {
    path: "/iam/recover-password",
    component: () => import("./views/recover-password/RecoverPassword.vue"),
    meta: { anonymous: true },
  },
  {
    path: "/iam/sign-in",
    component: () => import("./views/sign-in/SignIn.vue"),
    meta: { anonymous: true },
  },
  {
    path: "/iam/sign-up",
    component: () => import("./views/sign-up/SignUp.vue"),
    meta: { anonymous: true },
  },
];
