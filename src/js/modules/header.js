export function initHeader() {
    const mobileTrigger = document.querySelector('.site-header__mobile-trigger');
    const mobileNav = document.getElementById('mobileNav');
    const body = document.body;
    const header = document.querySelector('.site-header');

    if (!mobileTrigger || !mobileNav) return;

    mobileTrigger.addEventListener('click', function() {
        const isOpen = this.classList.contains('is-active');
        this.classList.toggle('is-active');
        mobileNav.classList.toggle('is-open');
        this.setAttribute('aria-expanded', !isOpen);
        mobileNav.setAttribute('aria-hidden', isOpen);
        body.classList.toggle('no-scroll', !isOpen);
    });

    function closeMobileMenu() {
        mobileTrigger.classList.remove('is-active');
        mobileNav.classList.remove('is-open');
        mobileTrigger.setAttribute('aria-expanded', 'false');
        mobileNav.setAttribute('aria-hidden', 'true');
        body.classList.remove('no-scroll');
    }

    const mobileLinks = mobileNav.querySelectorAll('.site-header__menu-link');
    mobileLinks.forEach(link => link.addEventListener('click', closeMobileMenu));

    window.addEventListener('scroll', function() {
        const scrollPosition = window.scrollY || document.documentElement.scrollTop;
        header.classList.toggle('scrolled', scrollPosition > 50);
    });

    document.addEventListener('click', function(event) {
        const isClickInsideNav = mobileNav.contains(event.target);
        const isClickOnTrigger = mobileTrigger.contains(event.target);
        
        if (!isClickInsideNav && !isClickOnTrigger && mobileNav.classList.contains('is-open')) {
            closeMobileMenu();
        }
    });
}
