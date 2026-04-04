export function initFooter() {
    try {
        const accordionContainers = document.querySelectorAll('.accordion-container');

        if (accordionContainers.length > 0) {
            accordionContainers.forEach(container => {
                const accordionItems = container.querySelectorAll('.accordion-item');
                
                accordionItems.forEach(item => {
                    const header = item.querySelector('.accordion-item__header');
                    const content = item.querySelector('.accordion-item__content');

                    if (header && content) {
                        header.addEventListener('click', () => {
                            const isOpen = header.getAttribute('aria-expanded') === 'true';
                            header.setAttribute('aria-expanded', !isOpen);
                            
                            if (isOpen) {
                                content.style.maxHeight = null;
                            } else {
                                content.style.maxHeight = content.scrollHeight + "px";
                            }
                        });
                    }
                });
            });
        }
    } catch (error) {
        console.error("Error initializing accordions:", error);
    }
}
