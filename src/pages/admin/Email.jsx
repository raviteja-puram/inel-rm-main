import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../../services/session';
import AdminSidebar from '../../components/AdminSidebar';
import AdminTopbar from '../../components/AdminTopbar';
import {
  fetchEmailSettings,
  updateEmailSettings,
  fetchEmailRecipients,
  addEmailRecipient,
  updateEmailRecipient,
  deleteEmailRecipient,
  sendRiskEmailNow,
} from '../../services/api';

function Email() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [sendTime, setSendTime] = useState('17:30');
  const [reportType, setReportType] = useState('daily_inventory');

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  const [recipients, setRecipients] = useState([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);

  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientRole, setRecipientRole] = useState('');
  const [savingRecipient, setSavingRecipient] = useState(false);
  const [editingRecipientId, setEditingRecipientId] = useState(null);
  const [editRecipientName, setEditRecipientName] = useState('');
  const [editRecipientEmail, setEditRecipientEmail] = useState('');
  const [editRecipientRole, setEditRecipientRole] = useState('');

  if (!user) {
    navigate('/');
    return null;
  }

  useEffect(() => {
    fetchEmailSettings()
        .then((settings) => {
        setEmailEnabled(settings.enabled);
        setSendTime(settings.sendTime);
        setReportType(settings.reportType);
        })
        .catch((error) => {
        console.error('Failed to load email settings:', error);
        })
        .finally(() => {
        setLoadingSettings(false);
        });
    }, []);

    useEffect(() => {
        fetchEmailRecipients()
            .then((data) => {
            setRecipients(data);
            })
            .catch((error) => {
            console.error('Failed to load email recipients:', error);
            })
            .finally(() => {
            setLoadingRecipients(false);
            });
        }, []);

    async function handleSaveSettings() {
        try {
            setSavingSettings(true);

            const updated = await updateEmailSettings({
            enabled: emailEnabled,
            sendTime,
            reportType,
            });

            setEmailEnabled(updated.enabled);
            setSendTime(updated.sendTime);
            setReportType(updated.reportType);

            alert('Email settings saved successfully.');
        } catch (error) {
            console.error('Failed to save email settings:', error);
            alert(error.message || 'Failed to save email settings.');
        } finally {
            setSavingSettings(false);
        }
    }

    async function handleAddRecipient() {
        if (!recipientName.trim()) {
            alert('Please enter the recipient name.');
            return;
        }

        if (!recipientEmail.trim()) {
            alert('Please enter the recipient email.');
            return;
        }

        try {
            setSavingRecipient(true);

            const newRecipient = await addEmailRecipient({
            name: recipientName.trim(),
            email: recipientEmail.trim(),
            role: recipientRole.trim(),
            });

            setRecipients((current) => [...current, newRecipient]);

            setRecipientName('');
            setRecipientEmail('');
            setRecipientRole('');
            setShowAddRecipient(false);

            alert('Email recipient added successfully.');
        } catch (error) {
            console.error('Failed to add email recipient:', error);
            alert(error.message || 'Failed to add email recipient.');
        } finally {
            setSavingRecipient(false);
        }
    }
    async function handleSendReportNow() {
      try {
        const confirmed = window.confirm(
          'Send the daily inventory report to all enabled recipients now?'
        );

        if (!confirmed) return;

        const result = await sendRiskEmailNow();

        alert(
          `Report sent successfully to ${result.recipientCount} recipient(s).`
        );
      } catch (error) {
        console.error('Failed to send report:', error);
        alert(error.message || 'Failed to send report.');
      }
    }

    function handleEditRecipient(recipient) {
      setEditingRecipientId(recipient.id);
      setEditRecipientName(recipient.name);
      setEditRecipientEmail(recipient.email);
      setEditRecipientRole(recipient.role || '');
    }
    async function handleSaveRecipient(id) {
      if (!editRecipientName.trim() || !editRecipientEmail.trim()) {
        alert('Name and email are required.');
        return;
      }

      try {
        setSavingRecipient(true);

        const updated = await updateEmailRecipient(id, {
          name: editRecipientName.trim(),
          email: editRecipientEmail.trim(),
          role: editRecipientRole.trim(),
          enabled: true,
        });

        setRecipients((current) =>
          current.map((recipient) =>
            recipient.id === id
              ? {
                  ...recipient,
                  name: updated.name,
                  email: updated.email,
                  role: updated.role || '',
                  enabled: Boolean(updated.enabled),
                }
              : recipient
          )
        );

        setEditingRecipientId(null);

        alert('Recipient updated successfully.');
      } catch (error) {
        console.error('Failed to update recipient:', error);
        alert(error.message || 'Failed to update recipient.');
      } finally {
        setSavingRecipient(false);
      }
    }
    function handleCancelEdit() {
      setEditingRecipientId(null);
      setEditRecipientName('');
      setEditRecipientEmail('');
      setEditRecipientRole('');
    }
    async function handleDeleteRecipient(id) {
      const confirmed = window.confirm(
        'Are you sure you want to delete this recipient?'
      );

      if (!confirmed) return;

      try {
        await deleteEmailRecipient(id);

        setRecipients((current) =>
          current.filter((recipient) => recipient.id !== id)
        );

        alert('Recipient deleted successfully.');
      } catch (error) {
        console.error('Failed to delete recipient:', error);
        alert(error.message || 'Failed to delete recipient.');
      }
    }

  return (
    <div className="erp-admin email-page flex h-screen overflow-hidden bg-[#05050a] text-white">
      <AdminSidebar active="email" user={user} />

      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminTopbar
          title="Email Management"
          description="Manage daily inventory reports and email recipients"
          user={user}
        />

        <div className="email-content flex-1 overflow-y-auto p-6">
          <div className="email-shell overflow-hidden rounded-xl border">

            <section className="border-b border-slate-200 bg-white p-5">
                <div className="mb-5">
                    <h2 className="text-sm font-semibold text-slate-900">
                    Daily Report Settings
                    </h2>

                    <p className="mt-1 text-[11px] text-slate-500">
                    Configure when the daily inventory report should be sent.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

                    {/* Enable / Disable */}
                    <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Automatic Report
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <div>
                        <div className="text-sm font-semibold text-slate-900">
                            Daily Email
                        </div>

                        <div className="mt-1 text-[11px] text-slate-500">
                            Automatically send the report every day.
                        </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => setEmailEnabled(!emailEnabled)}
                            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                                emailEnabled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                            >
                            {emailEnabled ? 'Enabled' : 'Disabled'}
                        </button>
                    </div>
                    </div>

                    {/* Report Type */}
                    <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Report Type
                    </div>

                    <select
                        value={reportType}
                        onChange={(e) => setReportType(e.target.value)}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    >
                        <option value="daily_inventory">
                        Daily Inventory
                        </option>
                    </select>
                    </div>

                    {/* Send Time */}
                    <div className="rounded-xl border border-slate-200 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Send Time
                    </div>

                    <input
                        type="time"
                        value={sendTime}
                        onChange={(e) => setSendTime(e.target.value)}
                        className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    />
                    </div>

                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleSendReportNow}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    Send Report Now
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings || loadingSettings}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
            </section>
                        {/* Email Recipients */}
            <section className="bg-white p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                    Email Recipients
                    </h2>

                    <p className="mt-1 text-[11px] text-slate-500">
                    Manage the users who will receive the daily inventory report.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => setShowAddRecipient(true)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
                >
                    + Add Recipient
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Name
                      </th>

                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Email
                      </th>

                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Role
                      </th>

                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Status
                      </th>

                      <th className="px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {recipients.map((recipient) => {
                      const isEditing = editingRecipientId === recipient.id;

                      return (
                        <tr key={recipient.id} className="border-t border-white/10">
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRecipientName}
                                onChange={(e) => setEditRecipientName(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-white outline-none"
                              />
                            ) : (
                              recipient.name
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="email"
                                value={editRecipientEmail}
                                onChange={(e) => setEditRecipientEmail(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-white outline-none"
                              />
                            ) : (
                              recipient.email
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editRecipientRole}
                                onChange={(e) => setEditRecipientRole(e.target.value)}
                                className="w-full rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-sm text-white outline-none"
                              />
                            ) : (
                              recipient.role || '-'
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {recipient.enabled ? 'Active' : 'Disabled'}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleSaveRecipient(recipient.id)}
                                  disabled={savingRecipient}
                                  className="rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                >
                                  {savingRecipient ? 'Saving...' : 'Save'}
                                </button>

                                <button
                                  onClick={handleCancelEdit}
                                  disabled={savingRecipient}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEditRecipient(recipient)}
                                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5"
                                >
                                  Edit
                                </button>

                                <button
                                  onClick={() => handleDeleteRecipient(recipient.id)}
                                  className="rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {showAddRecipient && (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">
                        Add Email Recipient
                    </h3>

                    <p className="mt-1 text-[11px] text-slate-500">
                        Enter the details of the person who should receive the report.
                    </p>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    {/* Name */}
                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Name
                        </label>

                        <input
                        type="text"
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Enter name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Email */}
                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Email
                        </label>

                        <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                        placeholder="Enter email address"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Role */}
                    <div>
                        <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Role
                        </label>

                        <input
                        type="text"
                        value={recipientRole}
                        onChange={(e) => setRecipientRole(e.target.value)}
                        placeholder="e.g. Manager"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500"
                        />
                    </div>
                    </div>

                    <div className="mt-4 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => setShowAddRecipient(false)}
                        disabled={savingRecipient}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleAddRecipient}
                        disabled={savingRecipient}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {savingRecipient ? 'Saving...' : 'Add Recipient'}
                    </button>
                    </div>
                </div>
                )}
            </section>

          </div>
        </div>
      </div>
    </div>
  );
}

export default Email;