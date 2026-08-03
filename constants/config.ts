/**
 * Configuration file for the School App.
 * You can modify the API_URL here to target different environments or backend servers.
 */

export const API_CONFIG = {
  // The domain of your notification API backend
  API_DOMAIN: 'https://2e51-2401-4900-b4e5-6e14-6d89-b3b-f19c-dbcf.ngrok-free.app',
  // The endpoint path of the notification API
  API_PATH: '/school_app_api/api/notification_api.php',
  // Combined API URL
  get API_URL() {
    return `${this.API_DOMAIN}${this.API_PATH}`;
  }
};
