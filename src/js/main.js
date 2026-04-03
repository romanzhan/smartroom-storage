import { initHeader } from './modules/header.js';
import { initFooter } from './modules/footer.js';
import { initCalculator } from './modules/calculator/index.js';

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initFooter();
  initCalculator();
});
