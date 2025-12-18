import React, { useState, useMemo, useEffect } from 'react';
import './BillingAnalysis.css';

const API_BASE = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/search/';
const ANNOTATION_API = 'https://10.191.171.12:5443/EISHOME_TEST/projectRoster/update_annotation/';

const BillingAnalysis = () => {
  // Search / filters
  const [q, setQ] = useState('');
  const [id, setId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [teamname, setTeamname] = useState('');
  const [shift, setShift] = useState('');
  const [action, setAction] = useState(''); // '', 'count', 'low_hours'

  // data + UI state
  const [billingData, setBillingData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // New state for fetched dates and months
  const [validDates, setValidDates] = useState([]);
  const [availableMonths, setAvailableMonths] = useState([]);
  
  // New state for teams and shifts dropdowns
  const [availableTeams, setAvailableTeams] = useState([]);
  const [availableShifts, setAvailableShifts] = useState([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showShiftDropdown, setShowShiftDropdown] = useState(false);
  
  // State for annotations (comments and status)
  const [annotations, setAnnotations] = useState({});
