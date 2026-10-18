(() => {
  const controls = document.querySelector('.project-filters');
  const cards = [...document.querySelectorAll('.project-card')];
  const categoryButtons = [...controls.querySelectorAll('[data-category]')];
  const options = controls.querySelector('.skill-filter-options');
  const clear = controls.querySelector('.clear-filters');
  const status = controls.querySelector('.filter-status');
  const empty = document.querySelector('.filter-empty');
  const skills = new Map(cards.map(card => [card,
    [...card.querySelectorAll('[data-skill]')].map(button => button.dataset.skill)
  ]));
  let category = 'All';
  let skill = '';

  [...new Set([...skills.values()].flat())].sort().forEach(label => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.skill = label;
    button.textContent = label;
    button.setAttribute('aria-pressed', 'false');
    options.append(button);
  });

  function update() {
    let count = 0;
    cards.forEach(card => {
      const matchesCategory = category === 'All' || card.dataset.categories.split('|').includes(category);
      card.hidden = !(matchesCategory && (!skill || skills.get(card).includes(skill)));
      if (!card.hidden) count++;
    });
    categoryButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    document.querySelectorAll('[data-skill]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.skill === skill)));
    status.textContent = `${count} ${count === 1 ? 'project' : 'projects'}${category !== 'All' ? ` · ${category}` : ''}${skill ? ` · ${skill}` : ''}`;
    clear.hidden = category === 'All' && !skill;
    empty.hidden = count !== 0;
  }

  categoryButtons.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.category;
    update();
  }));
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-skill]');
    if (!button) return;
    skill = skill === button.dataset.skill ? '' : button.dataset.skill;
    update();
  });
  clear.addEventListener('click', () => {
    category = 'All';
    skill = '';
    update();
    categoryButtons[0].focus();
  });
  controls.hidden = false;
  update();
})();
