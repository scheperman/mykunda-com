const {
  useState,
  useEffect,
  useCallback
} = React;
function DocPreviewModal({
  doc,
  onClose
}) {
  const dt = DOC_TYPES[doc.doc_type] || DOC_TYPES.other;
  const DOC_CONTENT = {
    title_deed: {
      org: 'Republic of The Gambia',
      title: 'Certificate of Title',
      subtitle: 'Department of Lands & Surveys',
      fields: [['Title Number', 'GMB/WD/2024/00████'], ['Property', 'Plot ██, ████████ Layout'], ['Region', 'West Coast Region'], ['Area', '████ sq. metres'], ['Registered Owner', '██████████ ████████'], ['Date of Issue', '██ / ██ / 20██'], ['Encumbrances', 'None recorded']],
      stamp: 'Official\nSeal'
    },
    ownership_letter: {
      org: 'Republic of The Gambia',
      title: 'Ownership Transfer Letter',
      subtitle: 'Office of the Alkaloo',
      fields: [['Reference', 'OTL/████/20██'], ['Transferor', '██████████ ████████'], ['Transferee', '██████████ ████████'], ['Property', 'Plot ██, ████████'], ['District', '████████ District'], ['Date of Transfer', '██ / ██ / 20██'], ['Witnessed By', '██████████ (Alkaloo)']],
      stamp: 'Verified\nCopy'
    },
    survey_plan: {
      org: 'Republic of The Gambia',
      title: 'Survey Plan',
      subtitle: 'Department of Physical Planning',
      fields: [['Plan Number', 'SP/████/20██'], ['Location', '████████, WCR'], ['Coordinates', '██.████°N, ██.████°W'], ['Total Area', '████ sq. metres'], ['Surveyor', '██████████ ████████'], ['Date', '██ / ██ / 20██']],
      stamp: 'Certified\nTrue Copy'
    },
    tax_receipt: {
      org: 'Gambia Revenue Authority',
      title: 'Property Tax Receipt',
      subtitle: 'Tax Clearance Certificate',
      fields: [['Receipt No.', 'GRA/PT/████/20██'], ['Taxpayer', '██████████ ████████'], ['Property', 'Plot ██, ████████'], ['Tax Year', '20██'], ['Amount Paid', 'GMD ██,███.00'], ['Date of Payment', '██ / ██ / 20██']],
      stamp: 'Paid'
    },
    other: {
      org: 'Supporting Document',
      title: 'Attached Document',
      subtitle: '',
      fields: [['Document', doc.filename], ['File size', formatFileSize(doc.file_size)], ['Uploaded', formatDate(doc.created_at)]],
      stamp: ''
    }
  };
  const content = DOC_CONTENT[doc.doc_type] || DOC_CONTENT.other;
  return React.createElement("div", {
    className: "doc-modal-overlay",
    onClick: onClose
  }, React.createElement("div", {
    className: "doc-modal",
    onClick: e => e.stopPropagation()
  }, React.createElement("div", {
    className: "doc-toolbar"
  }, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement("span", {
    style: {
      fontSize: 20
    }
  }, dt.icon), React.createElement("span", {
    className: "doc-name"
  }, doc.filename), React.createElement("span", {
    style: {
      color: 'var(--muted)'
    }
  }, "(", formatFileSize(doc.file_size), ")")), React.createElement("button", {
    onClick: onClose,
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      background: 'transparent',
      color: 'var(--ink-2)',
      fontSize: 20,
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, "\xD7")), React.createElement("div", {
    className: "doc-page"
  }, React.createElement("div", {
    className: "doc-page-header"
  }, React.createElement("div", {
    className: "doc-page-seal"
  }, "G"), React.createElement("h4", null, content.org), React.createElement("h3", null, content.title), content.subtitle && React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#666',
      marginTop: 2,
      fontFamily: 'var(--sans)'
    }
  }, content.subtitle)), content.fields.map(([label, value], i) => React.createElement("div", {
    className: "doc-field-row",
    key: i
  }, React.createElement("div", {
    className: "doc-field-label"
  }, label), React.createElement("div", {
    className: "doc-field-val"
  }, value))), React.createElement("div", {
    style: {
      marginTop: 28
    }
  }, React.createElement("div", {
    className: "doc-redacted w90"
  }), React.createElement("div", {
    className: "doc-redacted w85"
  }), React.createElement("div", {
    className: "doc-redacted w70"
  }), React.createElement("div", {
    className: "doc-redacted w60"
  })), React.createElement("div", {
    style: {
      marginTop: 30,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end'
    }
  }, React.createElement("div", null, React.createElement("div", {
    style: {
      borderTop: '1px solid #999',
      width: 140,
      marginBottom: 4
    }
  }), React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#888',
      fontFamily: 'var(--sans)'
    }
  }, "Authorized Signature")), React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, React.createElement("div", {
    style: {
      borderTop: '1px solid #999',
      width: 100,
      marginBottom: 4
    }
  }), React.createElement("div", {
    style: {
      fontSize: 10,
      color: '#888',
      fontFamily: 'var(--sans)'
    }
  }, "Date"))), content.stamp && React.createElement("div", {
    className: "doc-stamp"
  }, content.stamp)), React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 12,
      color: 'var(--muted)',
      marginBottom: 14
    }
  }, "Page 1 of 1"), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn btn-ghost",
    style: {
      flex: 1
    },
    onClick: onClose
  }, "Close"), React.createElement("button", {
    className: "btn btn-primary",
    style: {
      flex: 1
    }
  }, React.createElement("span", {
    style: {
      marginRight: 6
    }
  }, "\u2193"), " Download original"))));
}
function SellerSubmitView({
  listing,
  onSubmit,
  onCancel
}) {
  const [docs, setDocs] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  function handleUpload(docType, filename) {
    const newDoc = {
      id: 'new-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      doc_type: docType,
      filename: filename,
      file_size: Math.floor(Math.random() * 3000000) + 500000,
      created_at: new Date().toISOString()
    };
    setDocs(prev => [...prev, newDoc]);
  }
  function removeDoc(id) {
    setDocs(prev => prev.filter(d => d.id !== id));
  }
  const hasRequired = docs.some(d => d.doc_type === 'title_deed') && docs.some(d => d.doc_type === 'ownership_letter');
  function handleSubmit() {
    if (!hasRequired) return;
    setSubmitting(true);
    setTimeout(() => {
      onSubmit(listing, docs);
    }, 800);
  }
  return React.createElement("div", null, React.createElement("button", {
    className: "tv-back",
    onClick: onCancel
  }, "\u2190 Back to my verifications"), React.createElement("div", {
    className: "tv-panel",
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "tv-panel-head"
  }, React.createElement("h2", null, "Submit title verification")), React.createElement(ListingMini, {
    listing: listing
  })), React.createElement("div", {
    className: "tv-info"
  }, React.createElement("b", null, "What you need."), " Upload your title deed and ownership letter (required). Survey plans, tax receipts and ID copies help speed up approval."), React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 4,
      fontFamily: 'var(--serif)'
    }
  }, "Upload documents"), React.createElement("p", {
    style: {
      fontSize: '13.5px',
      color: 'var(--muted)',
      marginBottom: 16
    }
  }, "Click each box or drag and drop your files."), React.createElement("div", {
    className: "upload-grid"
  }, Object.entries(DOC_TYPES).map(([key, dt]) => {
    const uploaded = docs.filter(d => d.doc_type === key);
    if (uploaded.length > 0) {
      return React.createElement("div", {
        key: key,
        style: {
          border: '2px solid var(--green-200)',
          borderRadius: 'var(--r-md)',
          padding: 14,
          background: 'var(--green-50)',
          textAlign: 'center'
        }
      }, React.createElement("div", {
        style: {
          fontSize: 24,
          marginBottom: 4
        }
      }, "\u2713"), React.createElement("div", {
        style: {
          fontWeight: 700,
          fontSize: '13px',
          color: 'var(--green-700)'
        }
      }, dt.label), React.createElement("div", {
        style: {
          fontSize: '12px',
          color: 'var(--muted)',
          marginTop: 2
        }
      }, uploaded[0].filename), React.createElement("button", {
        onClick: () => removeDoc(uploaded[0].id),
        style: {
          marginTop: 8,
          fontSize: '12px',
          color: '#C2533A',
          fontWeight: 600,
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--sans)'
        }
      }, "Remove"));
    }
    return React.createElement(UploadZone, {
      key: key,
      docType: key,
      onUpload: handleUpload
    });
  })), docs.length > 0 && React.createElement("div", {
    style: {
      marginTop: 20,
      paddingTop: 18,
      borderTop: '1px solid var(--line-2)'
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '14px',
      marginBottom: 8,
      color: 'var(--ink-2)'
    }
  }, docs.length, " document", docs.length !== 1 ? 's' : '', " ready"), docs.map(doc => React.createElement(DocRow, {
    key: doc.id,
    doc: doc
  }))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 22,
      justifyContent: 'flex-end'
    }
  }, React.createElement("button", {
    className: "btn btn-ghost",
    onClick: onCancel
  }, "Cancel"), React.createElement("button", {
    className: "btn btn-primary",
    onClick: handleSubmit,
    disabled: !hasRequired || submitting,
    style: {
      opacity: !hasRequired || submitting ? 0.5 : 1,
      cursor: !hasRequired || submitting ? 'not-allowed' : 'pointer'
    }
  }, submitting ? 'Submitting…' : 'Submit for verification')), !hasRequired && docs.length > 0 && React.createElement("p", {
    style: {
      fontSize: '12.5px',
      color: '#C2533A',
      fontWeight: 600,
      textAlign: 'right',
      marginTop: 6
    }
  }, "Title deed and ownership letter are both required")));
}
function SellerDetailView({
  verification,
  onBack
}) {
  const cfg = STATUS_CONFIG[verification.status];
  const [viewingDoc, setViewingDoc] = useState(null);
  return React.createElement("div", null, React.createElement("button", {
    className: "tv-back",
    onClick: onBack
  }, "\u2190 Back to my verifications"), viewingDoc && React.createElement(DocPreviewModal, {
    doc: viewingDoc,
    onClose: () => setViewingDoc(null)
  }), React.createElement("div", {
    className: "tv-detail"
  }, React.createElement("div", null, React.createElement("div", {
    className: "tv-panel",
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "tv-panel-head"
  }, React.createElement("h2", null, "Verification details"), React.createElement(VerifStatusBadge, {
    status: verification.status,
    size: "lg"
  })), React.createElement(ListingMini, {
    listing: verification.listing
  })), verification.status === 'approved' && React.createElement("div", {
    className: "tv-success"
  }, React.createElement("b", null, "Title verified."), " Your listing now shows the Verified badge, giving buyers confidence in the property's legal standing."), verification.status === 'info_requested' && React.createElement("div", {
    className: "tv-info"
  }, React.createElement("b", null, "Action needed."), " ", verification.info_request_note || 'The reviewer has requested additional information or documents. Please upload the requested items.'), verification.status === 'rejected' && React.createElement("div", {
    style: {
      borderLeft: '4px solid #C2533A',
      background: '#FBEEEA',
      padding: '14px 18px',
      borderRadius: '0 var(--r-md) var(--r-md) 0',
      fontSize: '13.5px',
      color: '#C2533A',
      lineHeight: 1.5,
      marginBottom: 22
    }
  }, React.createElement("b", null, "Verification denied."), " ", verification.rejection_reason || 'The submitted documents could not be verified. Please contact support for next steps.'), React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      marginBottom: 22
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Uploaded documents"), verification.docs.map(doc => React.createElement(DocRow, {
    key: doc.id,
    doc: doc,
    showActions: true,
    onView: setViewingDoc
  }))), verification.reviewer_notes && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      marginBottom: 22
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 10,
      fontFamily: 'var(--serif)'
    }
  }, "Reviewer notes"), React.createElement("p", {
    style: {
      fontSize: '14.5px',
      color: 'var(--ink-2)',
      lineHeight: 1.6
    }
  }, verification.reviewer_notes))), React.createElement("aside", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, React.createElement("div", {
    className: "tv-sidebar-card"
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Timeline"), React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 0
    }
  }, [['Submitted', verification.submitted_at], ['Review started', verification.reviewed_at], ['Completed', verification.completed_at]].map(([label, ts], i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid var(--line-2)',
      fontSize: '14px'
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, label), React.createElement("span", {
    style: {
      color: ts ? 'var(--ink)' : 'var(--muted-2)',
      fontWeight: ts ? 600 : 400
    }
  }, ts ? formatDate(ts) : '—'))))), React.createElement("div", {
    className: "tv-sidebar-card"
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Audit trail"), React.createElement(AuditTrail, {
    entries: verification.audit
  })))));
}
function SellerView({
  verifications,
  setVerifications,
  showToast
}) {
  const [subView, setSubView] = useState('list');
  const [selectedListing, setSelectedListing] = useState(null);
  const [selectedVerif, setSelectedVerif] = useState(null);
  const myVerifs = verifications.filter(v => v.owner?.name === 'Ousman Jallow');
  const hasUnverifiedListings = DEMO_LISTINGS.some(l => !verifications.find(v => v.listing_id === l.id && v.status !== 'rejected'));
  function handleSubmit(listing, docs) {
    const newVerif = {
      id: 'v-' + Date.now(),
      listing_id: listing.id,
      listing: listing,
      owner: {
        name: 'Ousman Jallow',
        email: 'ousman@example.gm'
      },
      status: 'pending',
      submitted_at: new Date().toISOString(),
      reviewed_at: null,
      completed_at: null,
      reviewer_notes: '',
      docs: docs,
      audit: [{
        action: 'submitted',
        to_status: 'pending',
        actor_role: 'seller',
        created_at: new Date().toISOString(),
        note: null
      }]
    };
    setVerifications(prev => [newVerif, ...prev]);
    setSubView('list');
    showToast("Demo only \u2014 nothing is sent from this page. Order a real check at mykunda.com/verify.html");
  }
  if (subView === 'submit' && selectedListing) {
    return React.createElement(SellerSubmitView, {
      listing: selectedListing,
      onSubmit: handleSubmit,
      onCancel: () => setSubView('list')
    });
  }
  if (subView === 'detail' && selectedVerif) {
    return React.createElement(SellerDetailView, {
      verification: selectedVerif,
      onBack: () => setSubView('list')
    });
  }
  return React.createElement("div", null, React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 22
    }
  }, React.createElement("div", null, React.createElement("h2", {
    style: {
      fontSize: 22,
      fontFamily: 'var(--serif)'
    }
  }, "My title verifications"), React.createElement("p", {
    style: {
      fontSize: '14px',
      color: 'var(--muted)',
      marginTop: 4
    }
  }, "Get the Verified badge for your listings \u2014 builds buyer trust and ranks higher in search.")), hasUnverifiedListings && React.createElement("div", {
    style: {
      position: 'relative'
    }
  }, React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => {
      const unverified = DEMO_LISTINGS.find(l => !verifications.find(v => v.listing_id === l.id && v.status !== 'rejected'));
      if (unverified) {
        setSelectedListing(unverified);
        setSubView('submit');
      }
    }
  }, "+ Start verification"))), myVerifs.length > 0 ? React.createElement("div", {
    className: "tv-panel"
  }, React.createElement("div", {
    className: "tv-panel-head"
  }, React.createElement("h2", {
    style: {
      fontSize: 18
    }
  }, "Your verifications"), React.createElement("span", {
    style: {
      fontSize: '13px',
      color: 'var(--muted)',
      fontWeight: 600,
      background: 'var(--paper-2)',
      padding: '4px 11px',
      borderRadius: 'var(--r-pill)'
    }
  }, myVerifs.length, " total")), myVerifs.map(v => React.createElement("div", {
    key: v.id,
    onClick: () => {
      setSelectedVerif(v);
      setSubView('detail');
    },
    style: {
      cursor: 'pointer'
    }
  }, React.createElement(ListingMini, {
    listing: v.listing,
    status: v.status
  })))) : React.createElement("div", {
    className: "tv-panel"
  }, React.createElement("div", {
    className: "tv-empty"
  }, React.createElement("h3", null, "No verifications yet"), React.createElement("p", null, "Submit your title documents to get the Verified badge on your listing."))), verifications.filter(v => v.status === 'approved').length > 0 && React.createElement("div", {
    style: {
      marginTop: 22,
      background: 'linear-gradient(160deg, var(--green-800), var(--green-700))',
      borderRadius: 'var(--r-lg)',
      padding: 24,
      color: '#fff'
    }
  }, React.createElement("div", {
    style: {
      fontSize: '12px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '.07em',
      color: 'var(--amber-400)',
      marginBottom: 10
    }
  }, "Verified titles"), React.createElement("h3", {
    style: {
      color: '#fff',
      fontSize: 19,
      marginBottom: 8
    }
  }, "Verified listings get 3\xD7 more enquiries"), React.createElement("p", {
    style: {
      color: 'rgba(255,255,255,.84)',
      fontSize: '14px',
      lineHeight: 1.55
    }
  }, "Buyers trust properties with verified titles. Start the verification process from your dashboard to stand out.")));
}
function AdminDetailView({
  verification,
  onBack,
  onAction,
  showToast
}) {
  const [notes, setNotes] = useState(verification.reviewer_notes || '');
  const [rejectReason, setRejectReason] = useState('');
  const [infoNote, setInfoNote] = useState('');
  const [actionMode, setActionMode] = useState(null);
  const [viewingDoc, setViewingDoc] = useState(null);
  function handleAction(action) {
    const update = {
      ...verification
    };
    switch (action) {
      case 'start_review':
        update.status = 'in_review';
        update.reviewed_at = new Date().toISOString();
        update.audit = [...update.audit, {
          action: 'review_started',
          from_status: 'pending',
          to_status: 'in_review',
          actor_role: 'admin',
          created_at: new Date().toISOString(),
          note: null
        }];
        break;
      case 'approve':
        update.status = 'approved';
        update.completed_at = new Date().toISOString();
        update.reviewer_notes = notes;
        update.audit = [...update.audit, {
          action: 'approved',
          from_status: update.status === 'in_review' ? 'in_review' : update.status,
          to_status: 'approved',
          actor_role: 'admin',
          created_at: new Date().toISOString(),
          note: notes || 'All documents verified.'
        }];
        showToast('Title approved — Verified badge is now live on the listing');
        break;
      case 'reject':
        update.status = 'rejected';
        update.completed_at = new Date().toISOString();
        update.rejection_reason = rejectReason;
        update.audit = [...update.audit, {
          action: 'rejected',
          from_status: 'in_review',
          to_status: 'rejected',
          actor_role: 'admin',
          created_at: new Date().toISOString(),
          note: rejectReason
        }];
        showToast('Verification rejected — seller has been notified');
        break;
      case 'info_request':
        update.status = 'info_requested';
        update.info_request_note = infoNote;
        update.audit = [...update.audit, {
          action: 'info_requested',
          from_status: 'in_review',
          to_status: 'info_requested',
          actor_role: 'admin',
          created_at: new Date().toISOString(),
          note: infoNote
        }];
        showToast('Info request sent to seller');
        break;
    }
    onAction(update);
    setActionMode(null);
  }
  const canReview = verification.status === 'pending' || verification.status === 'info_requested';
  const isReviewing = verification.status === 'in_review';
  const isDone = verification.status === 'approved' || verification.status === 'rejected';
  return React.createElement("div", null, React.createElement("button", {
    className: "tv-back",
    onClick: onBack
  }, "\u2190 Back to review queue"), viewingDoc && React.createElement(DocPreviewModal, {
    doc: viewingDoc,
    onClose: () => setViewingDoc(null)
  }), React.createElement("div", {
    className: "tv-detail"
  }, React.createElement("div", null, React.createElement("div", {
    className: "tv-panel",
    style: {
      marginBottom: 22
    }
  }, React.createElement("div", {
    className: "tv-panel-head"
  }, React.createElement("div", null, React.createElement("h2", {
    style: {
      fontSize: 20
    }
  }, "Review verification"), React.createElement("p", {
    style: {
      fontSize: '13px',
      color: 'var(--muted)',
      marginTop: 3
    }
  }, "Submitted by ", React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, verification.owner.name), " \xB7 ", verification.owner.email)), React.createElement(VerifStatusBadge, {
    status: verification.status,
    size: "lg"
  })), React.createElement(ListingMini, {
    listing: verification.listing
  })), canReview && React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, React.createElement("button", {
    className: "btn btn-primary btn-block",
    style: {
      height: 50
    },
    onClick: () => handleAction('start_review')
  }, "Start review")), React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      marginBottom: 22
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 4,
      fontFamily: 'var(--serif)'
    }
  }, "Submitted documents"), React.createElement("p", {
    style: {
      fontSize: '13px',
      color: 'var(--muted)',
      marginBottom: 12
    }
  }, verification.docs.length, " document", verification.docs.length !== 1 ? 's' : '', " uploaded"), verification.docs.map(doc => React.createElement(DocRow, {
    key: doc.id,
    doc: doc,
    showActions: true,
    onView: setViewingDoc
  })), React.createElement("div", {
    style: {
      marginTop: 16,
      padding: '14px 16px',
      background: 'var(--paper)',
      borderRadius: 'var(--r-md)'
    }
  }, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '13px',
      color: 'var(--ink-2)',
      marginBottom: 8
    }
  }, "Required documents check"), Object.entries(DOC_TYPES).filter(([, dt]) => dt.required).map(([key, dt]) => {
    const has = verification.docs.some(d => d.doc_type === key);
    return React.createElement("div", {
      key: key,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        fontSize: '13.5px'
      }
    }, React.createElement("span", {
      style: {
        color: has ? 'var(--green-700)' : '#C2533A',
        fontWeight: 700
      }
    }, has ? '✓' : '✕'), React.createElement("span", {
      style: {
        color: has ? 'var(--ink-2)' : '#C2533A'
      }
    }, dt.label));
  }))), isReviewing && !actionMode && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Decision"), React.createElement("div", {
    className: "tv-field"
  }, React.createElement("label", null, "Reviewer notes (visible to seller)"), React.createElement("textarea", {
    rows: 3,
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Your assessment of the submitted documents\u2026"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn btn-primary",
    style: {
      flex: 1.5
    },
    onClick: () => setActionMode('approve')
  }, "Approve title"), React.createElement("button", {
    className: "btn btn-ghost",
    style: {
      flex: 1,
      color: 'var(--amber-600)',
      boxShadow: 'inset 0 0 0 1.5px var(--amber-400)'
    },
    onClick: () => setActionMode('info')
  }, "Request info"), React.createElement("button", {
    className: "btn btn-ghost",
    style: {
      flex: 1,
      color: '#C2533A',
      boxShadow: 'inset 0 0 0 1.5px #E8ADAD'
    },
    onClick: () => setActionMode('reject')
  }, "Reject"))), actionMode === 'approve' && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      border: '2px solid var(--green-200)'
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 10,
      fontFamily: 'var(--serif)',
      color: 'var(--green-700)'
    }
  }, "Confirm approval"), React.createElement("p", {
    style: {
      fontSize: '14px',
      color: 'var(--ink-2)',
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, "This will set ", React.createElement("code", {
    style: {
      fontSize: '12px',
      background: 'var(--green-50)',
      color: 'var(--green-700)',
      padding: '2px 6px',
      borderRadius: 5
    }
  }, "is_verified_title = true"), " on the listing and display the Verified badge to buyers."), React.createElement("div", {
    className: "tv-field"
  }, React.createElement("label", null, "Final notes"), React.createElement("textarea", {
    rows: 2,
    value: notes,
    onChange: e => setNotes(e.target.value),
    placeholder: "Optional notes about the verification\u2026"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setActionMode(null)
  }, "Cancel"), React.createElement("button", {
    className: "btn btn-primary",
    onClick: () => handleAction('approve')
  }, "Confirm \u2014 approve title"))), actionMode === 'reject' && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      border: '2px solid #E8ADAD'
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 10,
      fontFamily: 'var(--serif)',
      color: '#C2533A'
    }
  }, "Reject verification"), React.createElement("div", {
    className: "tv-field"
  }, React.createElement("label", null, "Reason for rejection (sent to seller)"), React.createElement("textarea", {
    rows: 3,
    value: rejectReason,
    onChange: e => setRejectReason(e.target.value),
    placeholder: "Explain why the verification cannot be approved\u2026"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setActionMode(null)
  }, "Cancel"), React.createElement("button", {
    className: "btn btn-ghost",
    style: {
      color: '#C2533A',
      boxShadow: 'inset 0 0 0 1.5px #E8ADAD'
    },
    onClick: () => handleAction('reject'),
    disabled: !rejectReason.trim()
  }, "Confirm rejection"))), actionMode === 'info' && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24,
      border: '2px solid var(--amber-400)'
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 10,
      fontFamily: 'var(--serif)',
      color: 'var(--amber-600)'
    }
  }, "Request more information"), React.createElement("div", {
    className: "tv-field"
  }, React.createElement("label", null, "What do you need from the seller?"), React.createElement("textarea", {
    rows: 3,
    value: infoNote,
    onChange: e => setInfoNote(e.target.value),
    placeholder: "e.g. Please upload a current survey plan and tax clearance receipt\u2026"
  })), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10
    }
  }, React.createElement("button", {
    className: "btn btn-ghost",
    onClick: () => setActionMode(null)
  }, "Cancel"), React.createElement("button", {
    className: "btn btn-amber",
    onClick: () => handleAction('info_request'),
    disabled: !infoNote.trim()
  }, "Send request to seller"))), isDone && verification.reviewer_notes && React.createElement("div", {
    className: "tv-panel",
    style: {
      padding: 24
    }
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 10,
      fontFamily: 'var(--serif)'
    }
  }, "Reviewer notes"), React.createElement("p", {
    style: {
      fontSize: '14.5px',
      color: 'var(--ink-2)',
      lineHeight: 1.6
    }
  }, verification.reviewer_notes))), React.createElement("aside", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, React.createElement("div", {
    className: "tv-sidebar-card"
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Seller"), React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14
    }
  }, React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'var(--green-700)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: '16px',
      flexShrink: 0
    }
  }, verification.owner.name[0]), React.createElement("div", null, React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: '15px'
    }
  }, verification.owner.name), React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--muted)'
    }
  }, verification.owner.email)))), React.createElement("div", {
    className: "tv-sidebar-card"
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Timeline"), [['Submitted', verification.submitted_at], ['Review started', verification.reviewed_at], ['Completed', verification.completed_at]].map(([label, ts], i) => React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '10px 0',
      borderBottom: '1px solid var(--line-2)',
      fontSize: '14px'
    }
  }, React.createElement("span", {
    style: {
      fontWeight: 600,
      color: 'var(--ink-2)'
    }
  }, label), React.createElement("span", {
    style: {
      color: ts ? 'var(--ink)' : 'var(--muted-2)',
      fontWeight: ts ? 600 : 400
    }
  }, ts ? formatDate(ts) : '—')))), React.createElement("div", {
    className: "tv-sidebar-card"
  }, React.createElement("h3", {
    style: {
      fontSize: 18,
      marginBottom: 14,
      fontFamily: 'var(--serif)'
    }
  }, "Audit trail"), React.createElement(AuditTrail, {
    entries: verification.audit
  })))));
}
function AdminView({
  verifications,
  setVerifications,
  showToast
}) {
  const [subView, setSubView] = useState('list');
  const [selectedVerif, setSelectedVerif] = useState(null);
  const [filter, setFilter] = useState('all');
  const pending = verifications.filter(v => v.status === 'pending' || v.status === 'info_requested');
  const inReview = verifications.filter(v => v.status === 'in_review');
  const completed = verifications.filter(v => v.status === 'approved' || v.status === 'rejected');
  const filtered = filter === 'all' ? verifications : filter === 'pending' ? pending : filter === 'in_review' ? inReview : completed;
  function handleAction(updatedVerif) {
    setVerifications(prev => prev.map(v => v.id === updatedVerif.id ? updatedVerif : v));
    setSelectedVerif(updatedVerif);
  }
  if (subView === 'detail' && selectedVerif) {
    const live = verifications.find(v => v.id === selectedVerif.id) || selectedVerif;
    return React.createElement(AdminDetailView, {
      verification: live,
      onBack: () => setSubView('list'),
      onAction: handleAction,
      showToast: showToast
    });
  }
  return React.createElement("div", null, React.createElement("div", {
    className: "tv-stats"
  }, [['Pending', pending.length], ['Under review', inReview.length], ['Approved', verifications.filter(v => v.status === 'approved').length], ['Total requests', verifications.length]].map(([lab, num], i) => React.createElement("div", {
    key: i,
    className: "tv-stat"
  }, React.createElement("div", {
    className: "num"
  }, num), React.createElement("div", {
    className: "lab"
  }, lab)))), React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginBottom: 20,
      flexWrap: 'wrap'
    }
  }, [['all', 'All', verifications.length], ['pending', 'Needs review', pending.length], ['in_review', 'In progress', inReview.length], ['completed', 'Completed', completed.length]].map(([key, label, count]) => React.createElement("button", {
    key: key,
    className: `vs-btn ${filter === key ? 'on' : ''}`,
    style: {
      height: 38,
      fontSize: '13.5px',
      padding: '0 16px'
    },
    onClick: () => setFilter(key)
  }, label, React.createElement("span", {
    className: "vs-badge",
    style: {
      minWidth: 18,
      height: 18,
      fontSize: '11px'
    }
  }, count)))), React.createElement("div", {
    className: "tv-panel"
  }, React.createElement("div", {
    className: "tv-panel-head"
  }, React.createElement("h2", {
    style: {
      fontSize: 18
    }
  }, "Verification requests")), filtered.length > 0 ? filtered.map(v => React.createElement("div", {
    key: v.id,
    style: {
      display: 'flex',
      gap: '16px',
      padding: '18px 22px',
      borderBottom: '1px solid var(--line-2)',
      alignItems: 'center',
      cursor: 'pointer',
      transition: '.12s'
    },
    onClick: () => {
      setSelectedVerif(v);
      setSubView('detail');
    },
    onMouseEnter: e => {
      e.currentTarget.style.background = 'var(--paper)';
    },
    onMouseLeave: e => {
      e.currentTarget.style.background = '';
    }
  }, React.createElement("img", {
    src: v.listing.img,
    alt: "",
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
  }), React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement("div", {
    style: {
      fontFamily: 'var(--serif)',
      fontSize: '16px',
      fontWeight: 600
    }
  }, v.listing.title), React.createElement("div", {
    style: {
      fontSize: '13px',
      color: 'var(--muted)',
      marginTop: 3
    }
  }, money(v.listing.price), " \xB7 ", v.listing.area), React.createElement("div", {
    style: {
      fontSize: '12.5px',
      color: 'var(--muted-2)',
      marginTop: 4
    }
  }, "by ", v.owner.name, " \xB7 ", timeAgo(v.submitted_at), " \xB7 ", v.docs.length, " doc", v.docs.length !== 1 ? 's' : '')), React.createElement(VerifStatusBadge, {
    status: v.status
  }))) : React.createElement("div", {
    className: "tv-empty"
  }, React.createElement("h3", null, "No requests matching this filter"), React.createElement("p", null, "Try a different filter above."))));
}
function App() {
  const [view, setView] = useState('admin');
  const [verifications, setVerifications] = useState(DEMO_VERIFICATIONS);
  const [toast, setToast] = useState(null);
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }
  const pendingCount = verifications.filter(v => v.status === 'pending' || v.status === 'info_requested').length;
  if (typeof adminNavCount === 'function') adminNavCount('titles', pendingCount);
  const sellerCount = verifications.filter(v => v.owner?.name === 'Ousman Jallow').length;
  return React.createElement("div", {
    className: "tv-wrap"
  }, React.createElement("div", {
    className: "tv-head"
  }, React.createElement("div", null, React.createElement("div", {
    className: "hi"
  }, "Title verification"), React.createElement("h1", null, "Title verification workflow"), React.createElement("p", null, "Submit documents for review, track verification status, and manage the Verified badge."))), React.createElement("div", {
    className: "view-switch"
  }, React.createElement("button", {
    className: `vs-btn ${view === 'seller' ? 'on' : ''}`,
    onClick: () => setView('seller')
  }, "Seller dashboard", React.createElement("span", {
    className: "vs-badge"
  }, sellerCount)), React.createElement("button", {
    className: `vs-btn ${view === 'admin' ? 'on' : ''}`,
    onClick: () => setView('admin')
  }, "Admin review", React.createElement("span", {
    className: "vs-badge"
  }, pendingCount))), view === 'seller' ? React.createElement(SellerView, {
    verifications: verifications,
    setVerifications: setVerifications,
    showToast: showToast
  }) : React.createElement(AdminView, {
    verifications: verifications,
    setVerifications: setVerifications,
    showToast: showToast
  }), toast && React.createElement("div", {
    className: "tv-toast"
  }, React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  })), toast));
}
ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(App, null));