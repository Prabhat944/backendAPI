const mongoose = require('mongoose');

mongoose.connection.once('open', async () => {
  try {
    const indexes = await mongoose.connection.collection('users').indexes();
    const emailIndex = indexes.find(i => i.key.email && i.name === 'email_1');
    
    if (emailIndex) {
      console.log('Dropping old email index...');
      await mongoose.connection.collection('users').dropIndex('email_1');
      console.log('Old email index dropped');
    }

    console.log('Creating new sparse unique email index...');
    await mongoose.connection.collection('users').createIndex(
      { email: 1 },
      { unique: true, sparse: true }
    );
    console.log('New sparse unique index created!');
  } catch (err) {
    console.error('Index update error:', err);
  }
});
