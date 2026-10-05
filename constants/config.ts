/**
 * Configuration file for the School App.
 * You can modify the API_URL here to target different environments or backend servers.
 */

export const API_CONFIG = {
  // The domain of your notification API backend
  API_DOMAIN: 'https://gms.tplpro.in',
  // API_DOMAIN: 'https://2d47-2401-4900-3e24-9201-3578-2691-bbb-ed91.ngrok-free.app/school_app_api',
  
  // The endpoint path of the notification API
  API_PATH: '/api/notification_api.php',
  // Combined API URL
  get API_URL() {
    return `${this.API_DOMAIN}${this.API_PATH}`;
  },
  // The endpoint path of the app version check API
  VERSION_CHECK_PATH: '/api/app_version_api.php',
  // Combined app version API URL
  get VERSION_CHECK_URL() {
    return `${this.API_DOMAIN}${this.VERSION_CHECK_PATH}`;
  },
  // The endpoint path to save push notification tokens
  SAVE_TOKEN_PATH: '/api/save_token.php',
  // Combined save token API URL
  get SAVE_TOKEN_URL() {
    return `${this.API_DOMAIN}${this.SAVE_TOKEN_PATH}`;
  },
  // The endpoint path to record notification receipt / acknowledgement
  RECEIPT_PATH: '/api/notification_receipt.php',
  // Combined notification receipt API URL
  get RECEIPT_URL() {
    return `${this.API_DOMAIN}${this.RECEIPT_PATH}`;
  },
  // Google Play Store URL for updates
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.tplpro.globalmindsschool'
};
