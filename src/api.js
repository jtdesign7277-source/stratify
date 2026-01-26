import { API_BASE_URL } from './config';

export const fetchStocks = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks`);
    if (!response.ok) throw new Error('Failed to fetch stocks');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stocks:', error);
    return null;
  }
};

export const fetchStock = async (symbol) => {
  try {
    const response = await fetch(`${API_BASE_URL}/stocks/${symbol}`);
    if (!response.ok) throw new Error(`Failed to fetch ${symbol}`);
    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
};

export const fetchIndices = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/indices`);
    if (!response.ok) throw new Error('Failed to fetch indices');
    return await response.json();
  } catch (error) {
    console.error('Error fetching indices:', error);
    return null;
  }
};

export const fetchNews = async (symbol) => {
  try {
    const response = await fetch(`${API_BASE_URL}/news/${symbol}`);
    if (!response.ok) throw new Error(`Failed to fetch news for ${symb