import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth'
import './App.css'
import { auth, db, googleProvider } from './firebase'

function App() {
  const [warehouseData, setWarehouseData] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [selectedSupplier, setSelectedSupplier] = useState('all')
  const [selectedItemType, setSelectedItemType] = useState('all')
  const [viewMode, setViewMode] = useState('full')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [voteCounts, setVoteCounts] = useState({ support: 0, against: 0 })
  const [voteLoading, setVoteLoading] = useState(false)
  const [voteError, setVoteError] = useState(null)
  const [voteMessage, setVoteMessage] = useState(null)
  const [userVote, setUserVote] = useState(null)

  useEffect(() => {
    async function loadWarehouseData() {
      try {
        const response = await fetch('/Warehouse_and_Retail_Sales.csv')
        if (!response.ok) {
          throw new Error(`Unable to load warehouse data (${response.status})`)
        }

        const csvText = await response.text()
        const parsedRows = parseCsv(csvText)
        setWarehouseData(parsedRows)
      } catch (error) {
        setLoadError(error)
      } finally {
        setLoading(false)
      }
    }

    loadWarehouseData()
  }, [])

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const votesRef = collection(db, 'votes')
    const unsubscribe = onSnapshot(
      votesRef,
      (snapshot) => {
        let support = 0
        let against = 0

        snapshot.forEach((document) => {
          const data = document.data()
          if (data.support === true) {
            support += 1
          } else if (data.support === false) {
            against += 1
          }
        })

        setVoteCounts({ support, against })
      },
      (error) => {
        setVoteError(error.message || 'Unable to load vote totals right now.')
      }
    )

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!currentUser) {
      setUserVote(null)
      return
    }

    const voteDocRef = doc(db, 'votes', currentUser.uid)
    const unsubscribe = onSnapshot(
      voteDocRef,
      (document) => {
        if (document.exists()) {
          const data = document.data()
          setUserVote(data.support === true)
        } else {
          setUserVote(null)
        }
      },
      (error) => {
        setVoteError(error.message || 'Unable to load your vote right now.')
      }
    )

    return () => unsubscribe()
  }, [currentUser])

  useEffect(() => {
    if (currentUser) {
      setVoteError(null)
    }
    if (!currentUser) {
      setVoteMessage(null)
    }
  }, [currentUser])

  const filterOptions = useMemo(() => computeFilterOptions(warehouseData), [warehouseData])
  const isSegmentMode = viewMode === 'segment'

  const filteredData = useMemo(() => {
    if (!isSegmentMode) {
      return warehouseData
    }

    return warehouseData.filter((row) => {
      const matchesSupplier = selectedSupplier === 'all' || row.SUPPLIER === selectedSupplier
      const matchesItemType = selectedItemType === 'all' || row['ITEM TYPE'] === selectedItemType
      return matchesSupplier && matchesItemType
    })
  }, [warehouseData, isSegmentMode, selectedSupplier, selectedItemType])

  const chartData = useMemo(() => buildMonthlyTotals(filteredData), [filteredData])
  const hasChartData = chartData.length > 0

  const handleRegister = async () => {
    setAuthLoading(true)
    setAuthError(null)

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      setAuthError(error.message || 'Unable to register right now.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleVote = async (support) => {
    if (!currentUser) {
      setVoteError('Please register to vote before casting your ballot.')
      setVoteMessage(null)
      return
    }

    setVoteLoading(true)
    setVoteError(null)
    setVoteMessage(null)

    try {
      await setDoc(
        doc(db, 'votes', currentUser.uid),
        {
          support,
          statementId: 'statement-of-intent',
          userDisplayName: currentUser.displayName ?? null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )
      setVoteMessage(
        support
          ? 'Thanks for supporting the statement. Your vote is saved.'
          : 'Thanks for sharing your concerns. Your vote is saved.'
      )
    } catch (error) {
      setVoteError(error.message || 'Unable to record your vote right now.')
    } finally {
      setVoteLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="hero">
        <h1>Priscilla Johnston for President</h1>
        <p className="hero-tagline">
          A steady hand for a stronger, more united future.
        </p>
      </header>

      <main>
        <section className="statement">
          <h2>Statement of Intent</h2>
          <p>
            I care about my constituents&apos; needs and am more than experienced
            to handle them. I have interned in US Senator Ed Markey&apos;s office
            and therefore have more experience than anyone else for this job.
          </p>
          <div className="register-panel">
            <button
              type="button"
              className="register-button"
              onClick={handleRegister}
              disabled={authLoading}
            >
              {authLoading ? 'Connecting…' : 'Register to Vote'}
            </button>
            {currentUser && (
              <p className="status success">
                Registered as {currentUser.displayName || currentUser.email}
              </p>
            )}
            {authError && <p className="status error">{authError}</p>}
          </div>
        </section>

        <section className="voter">
          <div className="voter-heading">
            <h2>Your Voice Matters</h2>
            <p className="voter-intro">
              Cast a quick vote on Priscilla&apos;s statement of intent—every response helps guide
              the campaign.
            </p>
          </div>

          <div className="vote-panel">
            {voteError && <p className="vote-error">{voteError}</p>}
            {voteMessage && <p className="success-message">{voteMessage}</p>}

            <div className="vote-actions">
              <button
                type="button"
                className={`vote-button support${userVote === true ? ' selected' : ''}`}
                onClick={() => handleVote(true)}
                disabled={voteLoading}
                aria-disabled={!currentUser}
              >
                {voteLoading ? 'Submitting…' : userVote === true ? 'You Support It' : 'I Support It'}
              </button>
              <button
                type="button"
                className={`vote-button against${userVote === false ? ' selected' : ''}`}
                onClick={() => handleVote(false)}
                disabled={voteLoading}
                aria-disabled={!currentUser}
              >
                {voteLoading ? 'Submitting…' : userVote === false ? 'You Oppose It' : 'I Oppose It'}
              </button>
            </div>

            {currentUser && userVote === null && (
              <p className="status muted">You haven&apos;t cast a vote yet.</p>
            )}
            {currentUser && userVote !== null && (
              <p className="status success">
                You currently {userVote ? 'support' : 'oppose'} the statement.
              </p>
            )}
            {!currentUser && (
              <p className="status muted">Register above to make your voice count.</p>
            )}
          </div>

          <div className="vote-results" aria-live="polite">
            <h3>Current Sentiment</h3>
            <div className="vote-summary">
              <div className="vote-summary-card support">
                <span className="count">{voteCounts.support}</span>
                <span className="label">Support</span>
              </div>
              <div className="vote-summary-card against">
                <span className="count">{voteCounts.against}</span>
                <span className="label">Oppose</span>
              </div>
            </div>
          </div>
        </section>

        <section className="warehouse">
          <div className="warehouse-heading">
            <h2>Warehouse and Retail Sales Snapshot</h2>
            <p>
              A transparent look at the supply chain performance powering our
              communities.
            </p>
          </div>

          {loading && <p className="status">Loading warehouse data…</p>}
          {loadError && (
            <p className="status error">
              We couldn&apos;t load the warehouse data right now. Please try again
              later.
            </p>
          )}

          {!loading && !loadError && (
            <div className="chart-card" role="figure" aria-label="Monthly sales trends">
              <div className="segmentation-controls" role="group" aria-label="Segment data">
                <div className="view-toggle">
                  <span className="toggle-label">View</span>
                  <label className="toggle-option">
                    <input
                      type="radio"
                      name="data-view"
                      value="full"
                      checked={!isSegmentMode}
                      onChange={() => {
                        setViewMode('full')
                        setSelectedSupplier('all')
                        setSelectedItemType('all')
                      }}
                    />
                    <span>Entire Dataset</span>
                  </label>
                  <label className="toggle-option">
                    <input
                      type="radio"
                      name="data-view"
                      value="segment"
                      checked={isSegmentMode}
                      onChange={() => setViewMode('segment')}
                    />
                    <span>Segment</span>
                  </label>
                </div>

                <fieldset className="filters" disabled={!isSegmentMode}>
                  <legend>Segment by</legend>
                  <div className="filter">
                    <label htmlFor="supplier-filter">Supplier</label>
                    <select
                      id="supplier-filter"
                      value={selectedSupplier}
                      onChange={(event) => setSelectedSupplier(event.target.value)}
                    >
                      <option value="all">All Suppliers</option>
                      {filterOptions.suppliers.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="filter">
                    <label htmlFor="item-type-filter">Item Type</label>
                    <select
                      id="item-type-filter"
                      value={selectedItemType}
                      onChange={(event) => setSelectedItemType(event.target.value)}
                    >
                      <option value="all">All Types</option>
                      {filterOptions.itemTypes.map((itemType) => (
                        <option key={itemType} value={itemType}>
                          {itemType}
                        </option>
                      ))}
                    </select>
                  </div>
                </fieldset>
              </div>

              {hasChartData ? (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="4 8" vertical={false} stroke="#cbd5f5" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#1e293b', fontSize: 12 }}
                      minTickGap={16}
                    />
                    <YAxis
                      tickFormatter={formatCompactNumber}
                      tick={{ fill: '#1e293b', fontSize: 12 }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }}
                      formatter={(value, name) => [formatNumber(value), name]}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="retailSales"
                      name="Retail Sales"
                      stroke="#2563eb"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="retailTransfers"
                      name="Retail Transfers"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="warehouseSales"
                      name="Warehouse Sales"
                      stroke="#dc2626"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state" role="status">
                  <p>No records match the current filters.</p>
                </div>
              )}
              <p className="chart-caption">
                {isSegmentMode
                  ? `${filteredData.length.toLocaleString()} records matched the selected filters.`
                  : `All ${warehouseData.length.toLocaleString()} records feed into this monthly trend chart.`}
              </p>
            </div>
          )}
        </section>
      </main>

      <footer className="footer">
        <p>Paid for by Friends of Priscilla Johnston</p>
      </footer>
    </div>
  )
}

export default App

function computeFilterOptions(dataRows) {
  const suppliers = new Set()
  const itemTypes = new Set()

  dataRows.forEach((row) => {
    if (row.SUPPLIER) {
      suppliers.add(row.SUPPLIER)
    }
    if (row['ITEM TYPE']) {
      itemTypes.add(row['ITEM TYPE'])
    }
  })

  return {
    suppliers: Array.from(suppliers).sort((a, b) => a.localeCompare(b)),
    itemTypes: Array.from(itemTypes).sort((a, b) => a.localeCompare(b)),
  }
}

function parseCsv(text) {
  const rows = []
  let currentField = ''
  let currentRow = []
  let insideQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const nextChar = text[index + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField || currentRow.length) {
        currentRow.push(currentField.trim())
        rows.push(currentRow)
        currentRow = []
        currentField = ''
      }
      if (char === '\r' && nextChar === '\n') {
        index += 1
      }
    } else {
      currentField += char
    }
  }

  if (currentField || currentRow.length) {
    currentRow.push(currentField.trim())
    rows.push(currentRow)
  }

  if (rows.length === 0) {
    return []
  }

  const headers = rows[0]
  return rows.slice(1).map((row) =>
    headers.reduce((accumulator, header, fieldIndex) => {
      const value = row[fieldIndex] ?? ''
      accumulator[header] = value
      return accumulator
    }, {})
  )
}

function buildMonthlyTotals(dataRows) {
  if (!dataRows.length) {
    return []
  }

  const totalsMap = new Map()

  dataRows.forEach((row) => {
    const year = Number.parseInt(row.YEAR, 10)
    const month = Number.parseInt(row.MONTH, 10)
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return
    }

    const monthKey = `${year}-${month.toString().padStart(2, '0')}`
    const existing = totalsMap.get(monthKey)

    const retailSales = toNumber(row['RETAIL SALES'])
    const retailTransfers = toNumber(row['RETAIL TRANSFERS'])
    const warehouseSales = toNumber(row['WAREHOUSE SALES'])

    if (existing) {
      existing.retailSales += retailSales
      existing.retailTransfers += retailTransfers
      existing.warehouseSales += warehouseSales
    } else {
      totalsMap.set(monthKey, {
        key: monthKey,
        label: formatMonthLabel(year, month),
        order: year * 100 + month,
        retailSales,
        retailTransfers,
        warehouseSales,
      })
    }
  })

  return Array.from(totalsMap.values())
    .sort((a, b) => a.order - b.order)
    .map(({ order, ...rest }) => rest)
}

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  const normalized = String(value ?? '').replace(/,/g, '').trim()
  if (!normalized) {
    return 0
  }

  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMonthLabel(year, month) {
  const monthValue = Math.max(1, Math.min(12, month))
  const date = new Date(Date.UTC(year, monthValue - 1))
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
  }).format(date)
}

const numberFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatNumber(value) {
  return numberFormatter.format(value)
}

function formatCompactNumber(value) {
  return compactNumberFormatter.format(value)
}

