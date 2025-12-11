
const { where } = require('firebase/firestore');

const c1 = where('orgId', '==', '123');
const c2 = where('orgId', '==', '123');

console.log('c1:', JSON.stringify(c1));
console.log('c2:', JSON.stringify(c2));
console.log('Equal stringify:', JSON.stringify(c1) === JSON.stringify(c2));

const c3 = [where('orgId', '==', '123')];
const c4 = [where('orgId', '==', '123')];

console.log('Array equal stringify:', JSON.stringify(c3) === JSON.stringify(c4));
