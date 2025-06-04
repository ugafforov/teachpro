
import React from 'react';
import StatisticsContainer from './statistics/StatisticsContainer';
import { StatisticsProps } from './statistics/types';

const Statistics: React.FC<StatisticsProps> = ({ teacherId }) => {
  return <StatisticsContainer teacherId={teacherId} />;
};

export default Statistics;
