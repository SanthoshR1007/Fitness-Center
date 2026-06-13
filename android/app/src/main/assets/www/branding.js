// Dragon Gym Branding Engine
function applyBranding() {
    const gymName = localStorage.getItem('gymName') || 'Dragon Gym';
    
    // Update Title
    const currentTitle = document.title;
    if (currentTitle.includes('|')) {
        document.title = `${gymName} | ${currentTitle.split('|')[1].trim()}`;
    } else {
        document.title = gymName;
    }

    // Update Navbar/Logo
    const logoElements = document.querySelectorAll('.logo, #sideLogo, #gymLogo, #gymTitle');
    logoElements.forEach(el => {
        // Preserve icon if present
        const icon = el.querySelector('i');
        if (icon) {
            el.innerHTML = '';
            el.appendChild(icon);
            el.innerHTML += ` ${gymName}`;
        } else {
            el.textContent = gymName;
        }
    });

    // Update Headers
    const headerElements = document.querySelectorAll('#headerName, #welcomeText');
    headerElements.forEach(el => {
        if (el.id === 'headerName') el.textContent = `${gymName} Admin`;
        if (el.id === 'welcomeText') el.textContent = `${gymName} Dashboard`;
    });
}

document.addEventListener('DOMContentLoaded', applyBranding);
window.addEventListener('storage', applyBranding); // Sync across tabs
