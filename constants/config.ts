/**
 * Configuration file for the School App.
 * You can modify the API_URL here to target different environments or backend servers.
 */

export const API_CONFIG = {
  // The domain of your notification API backend
  API_DOMAIN: 'https://gms.tplpro.in',
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
  // Google Play Store URL for updates
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.gms.schoolapp'
};
