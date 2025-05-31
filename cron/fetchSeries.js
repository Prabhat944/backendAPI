// cron/fetchSeries.js
const Series = require('../models/Series');
const { getUpcomingSeries } = require('../services/cricketService');

const saveSeries = async () => {
  const data = await getUpcomingSeries();

  for (const series of data?.data || []) {
    await Series.updateOne(
      { seriesId: series.id },
      {
        seriesId: series.id,
        name: series.name,
        startDate: new Date(series.startDate),
        endDate: series.endDate,
        matches: series.matches,
      },
      { upsert: true }
    );
  }
};

module.exports = saveSeries;
