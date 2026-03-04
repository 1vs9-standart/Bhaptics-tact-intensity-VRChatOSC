/**
 * Тестовый OSC-клиент для проверки middleware без VRChat
 * Отправляет имитацию ContactChest и ContactSpeed
 */
import { Client } from 'node-osc';

const client = new Client('127.0.0.1', 9001);

function send(param, value) {
  client.send(`/avatar/parameters/${param}`, value, () => {});
}

console.log('Sending test OSC messages (Ctrl+C to stop)...');

// Имитация резкого удара
setTimeout(() => {
  send('ContactChest', 1);
  send('ContactSpeed', 0.9);
  console.log('Sent: impact (high speed)');
}, 1000);

// Плавное касание
setTimeout(() => {
  send('ContactChest', 0.5);
  send('ContactSpeed', 0.2);
  console.log('Sent: smooth touch');
}, 2000);

// Сброс
setTimeout(() => {
  send('ContactChest', 0);
  send('ContactSpeed', 0);
  console.log('Sent: reset');
}, 3000);

setTimeout(() => {
  client.close();
  process.exit(0);
}, 4000);
