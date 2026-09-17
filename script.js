// Автоматический год в футере
document.getElementById('year').textContent = new Date().getFullYear();

// Обработка кнопки
document.getElementById('cta-button').addEventListener('click', () => {
    alert('Спасибо за клик! 🎉');
});

// Плавная прокрутка по якорным ссылкам
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});