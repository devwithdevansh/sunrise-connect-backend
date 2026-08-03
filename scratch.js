import mongoose from 'mongoose';
mongoose.connect('mongodb+srv://developerdevansh1:iWcT0fQZ56Kov2fQ@cluster0.z19ol.mongodb.net/sunrise_dev?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    const p = await mongoose.connection.db.collection('payments').findOne({ concessionAmount: { $gt: 0 } });
    console.log(p);
    process.exit(0);
  });
