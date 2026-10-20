// the element with this id; throws if the page doesn't have it
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`no element with id ${id}`);
  return el as T;
}

// the first match for selector under parent; throws if there isn't one
export function find<T extends Element = HTMLElement>(selector: string, parent: ParentNode = document): T {
  const el = parent.querySelector(selector);
  if (!el) throw new Error(`no element matching ${selector}`);
  return el as T;
}

export function containerHeader(title: string, parent: HTMLElement) {
  const div = document.createElement('div');
  div.classList.add('section-header');
  const span = document.createElement('span');
  span.innerText = title;
  div.appendChild(span);

  const toggleBtn = document.createElement('button');
  toggleBtn.classList.add('toggle-button');
  toggleBtn.textContent = '+';
  div.addEventListener('click', () => {
    const content = find('.section-content', parent);
    const isCollapsed = content.classList.contains('collapsed');
    content.classList.toggle('collapsed');
    toggleBtn.textContent = isCollapsed ? '-' : '+';
    parent.closest('.container')?.classList.toggle('collapsed');
  });

  div.appendChild(toggleBtn);
  return div
}
