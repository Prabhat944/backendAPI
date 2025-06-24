export const groupByTitle = (contests) => 
    contests.reduce((acc, contest) => {
        (acc[contest.title] = acc[contest.title] || []).push(contest);
        return acc;
}, {});