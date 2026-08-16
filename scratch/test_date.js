const { formatInTimeZone, toDate } = require('date-fns-tz');

const VN_TZ = 'Asia/Ho_Chi_Minh';
const now = new Date();
const todayDateString = formatInTimeZone(now, VN_TZ, 'yyyy-MM-dd');
const startOfDay = toDate(`${todayDateString}T00:00:00`, { timeZone: VN_TZ });

console.log('now:', now);
console.log('todayDateString:', todayDateString);
console.log('startOfDay:', startOfDay);
console.log('startOfDay.toISOString():', startOfDay.toISOString());
