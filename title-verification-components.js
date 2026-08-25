const DOC_TYPES = {
  title_deed: {
    label: 'Title deed',
    icon: '📜',
    required: true
  },
  ownership_letter: {
    label: 'Ownership letter',
    icon: '✉️',
    required: true
  },
  survey_plan: {
    label: 'Survey / site plan',
    icon: '📐',
    required: false
  },
  tax_receipt: {
    label: 'Tax clearance receipt',
    icon: '🧾',
    required: false
  },
  id_document: {
    label: 'Owner ID (passport/national ID)',
    icon: '🪪',
    required: false
  },
  other: {
    label: 'Other supporting document',
    icon: '📎',
    required: false
  }
};
const STATUS_CONFIG = {
  pending: {
    label: 'Pending review',
    color: 'var(--amber-500)',
    bg: 'var(--amber-100)',
    textColor: 'var(--amber-600)',
    icon: '⏳'
  },
  in_review: {
    label: 'Under review',
    color: 'var(--green-500)',
    bg: 'var(--green-100)',
    textColor: 'var(--green-700)',
    icon: '🔍'
  },
  info_requested: {
    label: 'Info requested',
    color: 'var(--amber-600)',
    bg: 'var(--amber-50)',
    textColor: 'var(--amber-600)',
    icon: '📋'
  },
  approved: {
    label: 'Approved',
    color: 'var(--green-700)',
    bg: 'var(--green-100)',
    textColor: 'var(--green-700)',
    icon: '✓'
  },
  rejected: {
    label: 'Rejected',
    color: '#C2533A',
    bg: '#FBEEEA',
    textColor: '#C2533A',
    icon: '✕'
  }
};
const DEMO_LISTINGS = [{
  id: 'pr1',
  title: 'Beachfront Villa with Pool',
  area: 'Kololi · Kombo South',
  price: 245000,
  beds: 4,
  baths: 3,
  sqm: 320,
  img: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&q=80&auto=format&fit=crop',
  plan: 'verified'
}, {
  id: 'pr7',
  title: 'Beachfront Building Plot',
  area: 'Sanyang · Kombo South',
  price: 48000,
  beds: 0,
  baths: 0,
  sqm: 0,
  plot: 1200,
  img: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=400&q=80&auto=format&fit=crop',
  plan: 'basic'
}];
const DEMO_VERIFICATIONS = [{
  id: 'v1',
  listing_id: 'pr1',
  listing: DEMO_LISTINGS[0],
  owner: {
    name: 'Ousman Jallow',
    email: 'ousman@example.gm'
  },
  status: 'in_review',
  submitted_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  reviewed_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  reviewer_notes: '',
  docs: [{
    id: 'd1',
    doc_type: 'title_deed',
    filename: 'Title_Deed_Kololi_Plot_247.pdf',
    file_size: 2450000,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  }, {
    id: 'd2',
    doc_type: 'ownership_letter',
    filename: 'Ownership_Transfer_Letter.pdf',
    file_size: 890000,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  }, {
    id: 'd3',
    doc_type: 'survey_plan',
    filename: 'Survey_Plan_2024.pdf',
    file_size: 1200000,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString()
  }],
  audit: [{
    action: 'submitted',
    to_status: 'pending',
    actor_role: 'seller',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    note: null
  }, {
    action: 'review_started',
    from_status: 'pending',
    to_status: 'in_review',
    actor_role: 'admin',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    note: null
  }]
}, {
  id: 'v2',
  listing_id: 'ext1',
  listing: {
    id: 'ext1',
    title: 'New-Build Townhouse',
    area: 'Brusubi · Kombo North',
    price: 98000,
    beds: 3,
    baths: 2,
    sqm: 175,
    img: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=400&q=80&auto=format&fit=crop',
    plan: 'verified'
  },
  owner: {
    name: 'Fatou Ceesay',
    email: 'fatou@example.gm'
  },
  status: 'pending',
  submitted_at: new Date(Date.now() - 6 * 3600000).toISOString(),
  reviewed_at: null,
  reviewer_notes: '',
  docs: [{
    id: 'd4',
    doc_type: 'title_deed',
    filename: 'Brusubi_Phase2_Deed.pdf',
    file_size: 1800000,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString()
  }, {
    id: 'd5',
    doc_type: 'id_document',
    filename: 'Fatou_Passport_Scan.jpg',
    file_size: 520000,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString()
  }],
  audit: [{
    action: 'submitted',
    to_status: 'pending',
    actor_role: 'seller',
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    note: null
  }]
}, {
  id: 'v3',
  listing_id: 'ext2',
  listing: {
    id: 'ext2',
    title: 'Gated Estate Villa',
    area: 'Brufut · Kombo South',
    price: 385000,
    beds: 5,
    baths: 4,
    sqm: 410,
    img: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=400&q=80&auto=format&fit=crop',
    plan: 'premium'
  },
  owner: {
    name: 'Lamin Touray',
    email: 'lamin@example.gm'
  },
  status: 'approved',
  submitted_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  reviewed_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  completed_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  reviewer_notes: 'All documents verified. Title deed matches land registry records. Survey plan is current.',
  docs: [{
    id: 'd6',
    doc_type: 'title_deed',
    filename: 'Brufut_Heights_Deed.pdf',
    file_size: 3100000,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  }, {
    id: 'd7',
    doc_type: 'ownership_letter',
    filename: 'Transfer_Agreement_2024.pdf',
    file_size: 750000,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  }, {
    id: 'd8',
    doc_type: 'survey_plan',
    filename: 'Survey_Brufut_Plot_89.pdf',
    file_size: 2200000,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  }, {
    id: 'd9',
    doc_type: 'tax_receipt',
    filename: 'Tax_Clearance_2025.pdf',
    file_size: 420000,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString()
  }],
  audit: [{
    action: 'submitted',
    to_status: 'pending',
    actor_role: 'seller',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    note: null
  }, {
    action: 'review_started',
    from_status: 'pending',
    to_status: 'in_review',
    actor_role: 'admin',
    created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
    note: null
  }, {
    action: 'approved',
    from_status: 'in_review',
    to_status: 'approved',
    actor_role: 'admin',
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    note: 'All documents verified. Title deed matches land registry records.'
  }]
}];
function timeAgo(ts) {
  const ms = Date.now() - new Date(ts).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}
function formatDateTime(ts) {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
function money(p) {
  return '$' + Number(p).toLocaleString('en-US');
}
function VerifStatusBadge({
  status,
  size
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const badgeStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: size === 'lg' ? '8px' : '6px',
    height: size === 'lg' ? '32px' : '27px',
    padding: size === 'lg' ? '0 14px' : '0 11px',
    borderRadius: '999px',
    background: cfg.bg,
    color: cfg.textColor,
    fontSize: size === 'lg' ? '13.5px' : '12px',
    fontWeight: 700,
    letterSpacing: '.02em'
  };
  const dotStyles = {
    width: size === 'lg' ? '8px' : '7px',
    height: size === 'lg' ? '8px' : '7px',
    borderRadius: '50%',
    background: cfg.color
  };
  return React.createElement('span', {
    style: badgeStyles
  }, React.createElement('span', {
    style: dotStyles
  }), cfg.label);
}
function DocRow({
  doc,
  showActions,
  onView
}) {
  const dt = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      padding: '14px 0',
      borderBottom: '1px solid var(--line-2)'
    }
  }, React.createElement('div', {
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--r-md)',
      background: 'var(--green-50)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '20px',
      flexShrink: 0
    }
  }, dt.icon), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      fontWeight: 700,
      fontSize: '14.5px',
      color: 'var(--ink)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, doc.filename), React.createElement('div', {
    style: {
      fontSize: '12.5px',
      color: 'var(--muted)',
      marginTop: 2,
      display: 'flex',
      gap: '10px'
    }
  }, React.createElement('span', null, dt.label), React.createElement('span', null, '·'), React.createElement('span', null, formatFileSize(doc.file_size)), doc.created_at && React.createElement(React.Fragment, null, React.createElement('span', null, '·'), React.createElement('span', null, timeAgo(doc.created_at))))), showActions && React.createElement('button', {
    onClick: () => onView && onView(doc),
    style: {
      height: 36,
      padding: '0 14px',
      borderRadius: 'var(--r-pill)',
      fontSize: '13px',
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
      flexShrink: 0,
      boxShadow: 'inset 0 0 0 1.5px var(--line)',
      background: 'var(--white)',
      color: 'var(--ink-2)',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      fontFamily: 'var(--sans)',
      transition: '.15s'
    },
    onMouseEnter: e => {
      e.target.style.boxShadow = 'inset 0 0 0 1.5px var(--green-500)';
      e.target.style.color = 'var(--green-700)';
    },
    onMouseLeave: e => {
      e.target.style.boxShadow = 'inset 0 0 0 1.5px var(--line)';
      e.target.style.color = 'var(--ink-2)';
    }
  }, '↗ View'));
}
function AuditTrail({
  entries
}) {
  if (!entries || !entries.length) return null;
  const sorted = [...entries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const actionLabels = {
    submitted: 'Verification submitted',
    review_started: 'Review started',
    info_requested: 'Additional info requested',
    doc_added: 'Document added',
    approved: 'Title approved ✓',
    rejected: 'Title rejected',
    resubmitted: 'Resubmitted for review'
  };
  const actionColors = {
    submitted: 'var(--amber-500)',
    review_started: 'var(--green-500)',
    info_requested: 'var(--amber-600)',
    doc_added: 'var(--muted)',
    approved: 'var(--green-700)',
    rejected: '#C2533A',
    resubmitted: 'var(--amber-500)'
  };
  return React.createElement('div', {
    style: {
      padding: '4px 0'
    }
  }, sorted.map((entry, i) => React.createElement('div', {
    key: i,
    style: {
      display: 'flex',
      gap: '14px',
      position: 'relative'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 20,
      flexShrink: 0
    }
  }, React.createElement('div', {
    style: {
      width: 12,
      height: 12,
      borderRadius: '50%',
      border: `3px solid ${actionColors[entry.action] || 'var(--muted)'}`,
      background: i === 0 ? actionColors[entry.action] || 'var(--muted)' : 'var(--white)',
      marginTop: 4,
      flexShrink: 0,
      zIndex: 1
    }
  }), i < sorted.length - 1 && React.createElement('div', {
    style: {
      width: 2,
      flex: 1,
      background: 'var(--line)',
      marginTop: 2,
      marginBottom: 2
    }
  })), React.createElement('div', {
    style: {
      flex: 1,
      paddingBottom: 20
    }
  }, React.createElement('div', {
    style: {
      fontWeight: 700,
      fontSize: '14px',
      color: i === 0 ? 'var(--ink)' : 'var(--ink-2)'
    }
  }, actionLabels[entry.action] || entry.action), React.createElement('div', {
    style: {
      fontSize: '12.5px',
      color: 'var(--muted)',
      marginTop: 3,
      display: 'flex',
      gap: '8px'
    }
  }, React.createElement('span', null, formatDateTime(entry.created_at)), React.createElement('span', null, '·'), React.createElement('span', {
    style: {
      textTransform: 'capitalize'
    }
  }, entry.actor_role || '—')), entry.note && React.createElement('div', {
    style: {
      marginTop: 8,
      padding: '10px 14px',
      borderRadius: 'var(--r-md)',
      background: 'var(--paper-2)',
      fontSize: '13.5px',
      color: 'var(--ink-2)',
      lineHeight: 1.5
    }
  }, entry.note)))));
}
function ListingMini({
  listing,
  status,
  onSelect
}) {
  return React.createElement('div', {
    onClick: onSelect,
    style: {
      display: 'flex',
      gap: '16px',
      padding: '18px 22px',
      borderBottom: '1px solid var(--line-2)',
      alignItems: 'center',
      cursor: onSelect ? 'pointer' : 'default',
      transition: '.12s'
    },
    onMouseEnter: onSelect ? e => {
      e.currentTarget.style.background = 'var(--paper)';
    } : undefined,
    onMouseLeave: onSelect ? e => {
      e.currentTarget.style.background = '';
    } : undefined
  }, React.createElement('img', {
    src: listing.img,
    alt: '',
    style: {
      width: 100,
      height: 70,
      borderRadius: 'var(--r-md)',
      objectFit: 'cover',
      background: 'var(--paper-2)',
      flexShrink: 0
    },
    onError: e => {
      e.target.style.display = 'none';
    }
  }), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: '16px',
      fontWeight: 600,
      color: 'var(--ink)'
    }
  }, listing.title), React.createElement('div', {
    style: {
      fontSize: '13px',
      color: 'var(--muted)',
      marginTop: 3
    }
  }, money(listing.price) + ' · ' + listing.area)), status && React.createElement(VerifStatusBadge, {
    status
  }));
}
function UploadZone({
  docType,
  onUpload
}) {
  const [dragging, setDragging] = React.useState(false);
  const dt = DOC_TYPES[docType] || DOC_TYPES.other;
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (onUpload) onUpload(docType, 'Uploaded_Document.pdf');
  }
  return React.createElement('div', {
    onDragOver: e => {
      e.preventDefault();
      setDragging(true);
    },
    onDragLeave: () => setDragging(false),
    onDrop: handleDrop,
    onClick: () => onUpload && onUpload(docType, dt.label.replace(/\s/g, '_') + '.pdf'),
    style: {
      border: `2px dashed ${dragging ? 'var(--green-500)' : 'var(--line)'}`,
      borderRadius: 'var(--r-md)',
      padding: '20px',
      textAlign: 'center',
      cursor: 'pointer',
      transition: '.15s',
      background: dragging ? 'var(--green-50)' : 'var(--white)'
    }
  }, React.createElement('div', {
    style: {
      fontSize: '24px',
      marginBottom: 6
    }
  }, dt.icon), React.createElement('div', {
    style: {
      fontWeight: 700,
      fontSize: '14px',
      color: 'var(--ink)'
    }
  }, dt.label), React.createElement('div', {
    style: {
      fontSize: '12.5px',
      color: 'var(--muted)',
      marginTop: 4
    }
  }, dt.required ? 'Required · Click or drop file' : 'Optional · Click or drop file'));
}
Object.assign(window, {
  DOC_TYPES,
  STATUS_CONFIG,
  DEMO_LISTINGS,
  DEMO_VERIFICATIONS,
  timeAgo,
  formatDate,
  formatDateTime,
  formatFileSize,
  money,
  VerifStatusBadge,
  DocRow,
  AuditTrail,
  ListingMini,
  UploadZone
});