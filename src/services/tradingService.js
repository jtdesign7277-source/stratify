import {
  fetchAccount as fetchBrokerAccount,
  placeOrder as placeBrokerOrder,
} from './alpacaService';

export const fetchTradingAccount = (...args) => fetchBrokerAccount(...args);
export const placeTradingOrder = (...args) => placeBrokerOrder(...args);
