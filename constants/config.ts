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
  }
};
