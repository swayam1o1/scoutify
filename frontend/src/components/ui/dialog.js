/**
 * App-wide replacement for window.alert / window.confirm.
 * Callable from hooks and plain functions; <DialogHost /> renders the queue.
 */
let queue = [];
let nextId = 1;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(queue);
}

function open(dialog) {
  return new Promise(resolve => {
    queue = [...queue, { ...dialog, id: nextId++, resolve }];
    emit();
  });
}

export function subscribeDialogs(listener) {
  listeners.add(listener);
  listener(queue);
  return () => listeners.delete(listener);
}

export function closeDialog(id, result) {
  const dialog = queue.find(item => item.id === id);
  queue = queue.filter(item => item.id !== id);
  emit();
  dialog?.resolve(result);
}

// tone: 'info' | 'success' | 'error'
export function showAlert(message, { title, tone = 'info', okLabel = 'OK' } = {}) {
  return open({ type: 'alert', message, title, tone, okLabel });
}

// Resolves true on confirm, false on cancel / Escape / backdrop click.
export function showConfirm(message, { title = 'Please confirm', confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return open({ type: 'confirm', message, title, confirmLabel, cancelLabel, danger, tone: danger ? 'error' : 'info' });
}
