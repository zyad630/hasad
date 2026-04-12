/**
 * Global Keyboard Navigation
 * Intercepts 'Enter' key and acts like 'Tab' to move focus to the next input field.
 * Ensures fast, mouse-free data entry.
 */
export const initGlobalKeyboardNavigation = () => {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const activeEl = document.activeElement as HTMLElement;

      // Allow screens/components to own Enter behavior (e.g. voucher grids)
      if (activeEl && (activeEl.closest('[data-enter-scope="local"]') as HTMLElement | null)) return;
      
      // Allow multi-line input in textareas
      if (activeEl && activeEl.tagName === 'TEXTAREA') return;
      
      // We only want to convert Enter -> Tab if the user is typing in an input or select field
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT')) {
          e.preventDefault(); 
          
          // Get all focusable elements on the screen in DOM order
          const query = 'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
          const focusable = Array.from(document.querySelectorAll(query)) as HTMLElement[];
          
          const currentIndex = focusable.indexOf(activeEl);
          if (currentIndex > -1 && currentIndex + 1 < focusable.length) {
              const nextEl = focusable[currentIndex + 1];
              nextEl.focus();
              
              // If the element is an input, optionally select all text for faster typing
              if (nextEl.tagName === 'INPUT') {
                  const inputEl = nextEl as HTMLInputElement;
                  // Some input types like number or email might throw an error on select() in some browsers, use try catch
                  try {
                      inputEl.select();
                  } catch (err) {}
              }
          }
      }
    }
  });
};
