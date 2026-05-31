import * as leafer from 'leafer-ui';
console.log('Has Image:', 'Image' in leafer);
console.log('Keys with image:', Object.keys(leafer).filter(k => k.toLowerCase().includes('image')));
