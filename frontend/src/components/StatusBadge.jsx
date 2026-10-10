import React from 'react';
import { ShieldCheck, AlertOctagon, Clock, Ban, CheckCircle, Lock } from 'lucide-react';

export default function StatusBadge({ status }) {
  const norm = (status || '').toUpperCase();

  if (norm === 'ACTIVE' || norm === 'CLEAN') {
    return (
      <span className="badge badge-active">
        <CheckCircle size={12} /> {norm}
      </span>
    );
  }

  if (norm === 'EXPIRED') {
    return (
      <span className="badge badge-expired">
        <Clock size={12} /> EXPIRED
      </span>
    );
  }

  if (norm === 'REVOKED' || norm === 'INFECTED') {
    return (
      <span className="badge badge-revoked">
        <Ban size={12} /> {norm}
      </span>
    );
  }

  if (norm === 'LIMIT_REACHED') {
    return (
      <span className="badge badge-limit">
        <Lock size={12} /> LIMIT REACHED
      </span>
    );
  }

  return (
    <span className="badge badge-blue">
      {status || 'UNKNOWN'}
    </span>
  );
}
