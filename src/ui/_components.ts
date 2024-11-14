export function containerHeader(title, parent) {
  const div = document.createElement('div');
  div.classList.add('section-header');
  const span = document.createElement('span');
  span.innerText = title;
  div.appendChild(span);

  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('toggle-button');
  toggleBtn.textContent = '-';
  div.addEventListener('click', () => {
    const content = parent.querySelector('.section-content');
    const isCollapsed = content.classList.contains('collapsed');
    content.classList.toggle('collapsed');
    toggleBtn.textContent = isCollapsed ? '-' : '+';
    const container = parent.closest('.container');
    container.classList.toggle('collapsed');
  });

  div.appendChild(toggleBtn);
  return div
}
