import { useRef, useState } from 'react'
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react'
import { Badge, Button, Card, CardBody, CardHeader, Modal, PageHeader } from '@/components/ui'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUniverseStore } from '@/stores/universeStore'
import { useCollectionStore } from '@/stores/collectionStore'
import { buildPayload, validateImport, type ImportValidation } from '@/utils/transfer'
import { cn } from '@/utils/cn'

function SwitchRow({
  title,
  description,
  checked,
  label,
  onToggle,
}: {
  title: string
  description: string
  checked: boolean
  label: string
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-200',
          checked ? 'border-dark bg-dark' : 'border-line bg-bg',
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all duration-200',
            checked ? 'left-[24px] bg-bg' : 'left-[3px] bg-silver',
          )}
        />
      </button>
    </div>
  )
}

export function SettingsPage() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.update)
  const resetSettings = useSettingsStore((s) => s.reset)
  const universes = useUniverseStore((s) => s.universes)
  const clearAll = useUniverseStore((s) => s.clearAll)
  const importData = useUniverseStore((s) => s.importData)
  const collectionRecords = useCollectionStore((s) => s.records)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [importReport, setImportReport] = useState<{
    fileName: string
    validation: ImportValidation
  } | null>(null)
  const [importedCount, setImportedCount] = useState<number | null>(null)
  const [skippedCount, setSkippedCount] = useState<number | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleExport() {
    const payload = JSON.stringify(
      buildPayload(universes, settings, collectionRecords),
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `parallel-life-export-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleFile(file: File) {
    setImportedCount(null)
    try {
      const text = await file.text()
      const raw: unknown = JSON.parse(text)
      setImportReport({ fileName: file.name, validation: validateImport(raw) })
    } catch {
      setImportReport({
        fileName: file.name,
        validation: {
          ok: false,
          errors: ['文件不是合法 JSON，无法解析'],
          universes: [],
          collections: [],
          settings: null,
        },
      })
    }
  }

  async function confirmImport() {
    if (!importReport?.validation.ok) return
    setDataError(null)
    try {
      const result = await importData(
        importReport.validation.universes,
        importReport.validation.collections,
      )
      if (importReport.validation.settings) {
        await updateSettings(importReport.validation.settings)
      }
      setImportedCount(result.imported)
      setSkippedCount(result.skipped)
      setImportReport(null)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : '导入失败，数据库未变更')
      setImportReport(null)
    }
  }

  async function handleClear() {
    setDataError(null)
    try {
      await clearAll()
      setConfirmClear(false)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : '清空失败，请重试')
    }
  }

  async function handleReset() {
    setDataError(null)
    try {
      await resetSettings()
      setConfirmReset(false)
    } catch (error) {
      setDataError(error instanceof Error ? error.message : '恢复默认失败，请重试')
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="System"
        title="系统设置"
        description="所有数据仅存储于本机浏览器，不上传任何服务器。"
      />

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <span className="pl-label">Experience</span>
          </CardHeader>
          <CardBody className="space-y-5">
            <SwitchRow
              title="减弱动效"
              description="关闭页面切换与数值过渡动画，获得更安静的体验。"
              checked={settings.reduceMotion}
              label="减弱动效"
              onToggle={() => void updateSettings({ reduceMotion: !settings.reduceMotion })}
            />
            <div className="border-t border-line pt-5">
              <SwitchRow
                title="音效"
                description="选择、确认、成就与结局的本地合成提示音（无音频资源）。"
                checked={settings.sound}
                label="音效"
                onToggle={() => void updateSettings({ sound: !settings.sound })}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="pl-label">Data</span>
          </CardHeader>
          <CardBody className="space-y-4">
            {dataError && (
              <p className="text-xs text-ink" role="alert">
                {dataError}
              </p>
            )}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">导出全部数据</p>
                <p className="mt-1 text-xs text-muted">
                  以 JSON 下载 {universes.length} 个宇宙与当前设置（含版本号，可再导入）。
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={handleExport}>
                <Download size={14} />
                导出
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div>
                <p className="text-sm font-medium">导入数据</p>
                <p className="mt-1 text-xs text-muted">
                  校验版本、结构、引用完整性与数值范围后合并导入；同 ID 宇宙会被覆盖。
                </p>
                {importedCount !== null && (
                  <p className="mt-1 text-xs text-ink">
                    已导入 {importedCount} 个宇宙
                    {skippedCount ? `，跳过 ${skippedCount} 个同 ID 重复（未覆盖）` : ''}。
                  </p>
                )}
              </div>
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload size={14} />
                导入
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="选择导入文件"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void handleFile(file)
                  e.target.value = ''
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div>
                <p className="text-sm font-medium">清空本地数据</p>
                <p className="mt-1 text-xs text-muted">删除全部宇宙与时间线，不可恢复。</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} />
                清空
              </Button>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
              <div>
                <p className="text-sm font-medium">恢复默认设置</p>
                <p className="mt-1 text-xs text-muted">动效与音效回到初始状态，不影响宇宙数据。</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={14} />
                恢复默认
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <span className="pl-label">About</span>
          </CardHeader>
          <CardBody>
            <p className="font-mono text-xs leading-relaxed text-muted">
              PARALLEL LIFE v0.1.0
              <br />
              ENGINE: PLE (Parallel Life Engine) · 100% LOCAL
              <br />
              STORAGE: IndexedDB (Dexie) · NO NETWORK CONTENT GENERATION
            </p>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={importReport !== null}
        onClose={() => setImportReport(null)}
        title="导入校验"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setImportReport(null)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!importReport?.validation.ok}
              onClick={() => void confirmImport()}
            >
              确认导入
            </Button>
          </>
        }
      >
        {importReport && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge tone={importReport.validation.ok ? 'dark' : 'silver'}>
                {importReport.validation.ok ? '校验通过' : '校验失败'}
              </Badge>
              <span className="font-mono text-xs text-silver">{importReport.fileName}</span>
            </div>
            {importReport.validation.ok ? (
              <p>
                包含 {importReport.validation.universes.length} 个宇宙、
                {importReport.validation.collections.length} 条图鉴记录
                {importReport.validation.settings ? '与设置项' : ''}
                。同 ID 宇宙将跳过而非覆盖，其余保留。
              </p>
            ) : (
              <ul className="space-y-1 text-xs leading-relaxed">
                {importReport.validation.errors.slice(0, 8).map((error) => (
                  <li key={error}>· {error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="恢复默认设置"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
              取消
            </Button>
            <Button size="sm" onClick={() => void handleReset()}>
              确认恢复
            </Button>
          </>
        }
      >
        动效与音效设置将回到默认值（动效开、音效开）。宇宙数据不受影响。
      </Modal>

      <Modal
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="清空本地数据"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
              取消
            </Button>
            <Button variant="danger" size="sm" onClick={() => void handleClear()}>
              确认清空
            </Button>
          </>
        }
      >
        即将永久删除全部 {universes.length} 个宇宙及其时间线数据。建议先导出备份。
      </Modal>
    </div>
  )
}