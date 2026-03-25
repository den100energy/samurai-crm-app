'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const GOALS = [
  'Физическое развитие (сила, выносливость)',
  'Похудеть',
  'Дисциплинированность',
  'Реализовать энергию',
  'Самооборона',
  'Личностное развитие',
  'Общение в здоровой компании',
  'Чтобы был чем-то занят',
]

const HEIGHT_OPTIONS = [
  { value: '<135', label: 'До 135 см' },
  { value: '135-160', label: '135–160 см' },
  { value: '>160', label: 'Выше 160 см' },
]

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-5">
      <div className="flex gap-1.5 mb-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-black' : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className="text-xs text-gray-400 text-right">Шаг {step} из {total}</p>
    </div>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-500 mt-0.5">{msg}</p>
}

function inputClass(hasError: boolean) {
  return `w-full border rounded-xl px-4 py-2.5 text-sm outline-none ${hasError ? 'border-red-400 bg-red-50' : 'border-gray-200 focus:border-gray-400'}`
}

export default function Survey3Page() {
  const { token } = useParams<{ token: string }>()
  const [profile, setProfile] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    // Шаг 1 — данные ученика
    last_name: '', first_name: '', middle_name: '',
    student_telegram: '', email: '',
    address: '', school_name: '', school_grade: '',
    height_category: '',
    training_start_date: '',
    // Шаг 2 — контакты родителей
    father_name: '', father_phone: '', father_telegram: '', father_in_group: false,
    mother_name: '', mother_phone: '', mother_telegram: '', mother_in_group: false,
    referral_source: '',
    contract_with: '' as '' | 'мама' | 'папа' | 'другой',
    // Шаг 3 — данные для договора (подписант)
    signer_last_name: '', signer_first_name: '', signer_middle_name: '',
    signer_birth_date: '',
    signer_passport_series: '', signer_passport_number: '',
    signer_passport_issued_by: '', signer_passport_issued_date: '',
    signer_address_reg: '', signer_address_fact: '',
    // Шаг 3 — документ ребёнка
    child_doc_type: '' as '' | 'свидетельство' | 'паспорт',
    child_doc_number: '',
    child_doc_issued_by: '',
    child_doc_issued_date: '',
    // Шаг 4 — цели + согласия
    goals: [] as string[],
    consent_rules: false, consent_contract: false, consent_personal_data: false,
  })

  useEffect(() => {
    supabase.from('student_profiles')
      .select('*, students(name, phone, birth_date)')
      .eq('survey_token', token)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setStudent(data.students)
          if (data.filled_at) setStep(99)
          const nameParts = data.students?.name?.split(' ') || []
          setForm(f => ({
            ...f,
            last_name: data.last_name || nameParts[0] || '',
            first_name: data.first_name || nameParts[1] || '',
            middle_name: data.middle_name || nameParts[2] || '',
            student_telegram: data.student_telegram || '',
            email: data.email || '',
            address: data.address || '',
            school_name: data.school_name || '',
            school_grade: data.school_grade || '',
            height_category: data.height_category || '',
            training_start_date: data.training_start_date || '',
            father_name: data.father_name || '',
            father_phone: data.father_phone || '',
            father_telegram: data.father_telegram || '',
            father_in_group: data.father_in_group || false,
            mother_name: data.mother_name || '',
            mother_phone: data.mother_phone || '',
            mother_telegram: data.mother_telegram || '',
            mother_in_group: data.mother_in_group || false,
            referral_source: data.referral_source || '',
            contract_with: data.contract_with || '',
            signer_last_name: data.signer_last_name || '',
            signer_first_name: data.signer_first_name || '',
            signer_middle_name: data.signer_middle_name || '',
            signer_birth_date: data.signer_birth_date || '',
            signer_passport_series: data.signer_passport_series || '',
            signer_passport_number: data.signer_passport_number || '',
            signer_passport_issued_by: data.signer_passport_issued_by || '',
            signer_passport_issued_date: data.signer_passport_issued_date || '',
            signer_address_reg: data.signer_address_reg || '',
            signer_address_fact: data.signer_address_fact || '',
            child_doc_type: data.child_doc_type || '',
            child_doc_number: data.child_doc_number || '',
            child_doc_issued_by: data.child_doc_issued_by || '',
            child_doc_issued_date: data.child_doc_issued_date || '',
            goals: data.goals || [],
          }))
        }
        setLoading(false)
      })
  }, [token])

  function set(key: string, value: any) {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => { const next = { ...e }; delete next[key]; return next })
  }

  function toggleGoal(goal: string) {
    setForm(f => ({
      ...f,
      goals: f.goals.includes(goal) ? f.goals.filter(g => g !== goal) : [...f.goals, goal],
    }))
  }

  function handleContractWith(val: 'мама' | 'папа' | 'другой') {
    const fullName = val === 'мама' ? form.mother_name : val === 'папа' ? form.father_name : ''
    const parts = fullName.trim().split(/\s+/)
    setForm(f => ({
      ...f,
      contract_with: val,
      signer_last_name: parts[0] || f.signer_last_name,
      signer_first_name: parts[1] || f.signer_first_name,
      signer_middle_name: parts[2] || f.signer_middle_name,
    }))
    setErrors(e => { const next = { ...e }; delete next.contract_with; return next })
  }

  function validateStep1() {
    const errs: Record<string, string> = {}
    if (!form.last_name.trim()) errs.last_name = 'Введите фамилию'
    if (!form.first_name.trim()) errs.first_name = 'Введите имя'
    return errs
  }

  function validateStep2() {
    const errs: Record<string, string> = {}
    if (!form.contract_with) errs.contract_with = 'Укажите кто подписывает договор'
    return errs
  }

  function validateStep3() {
    const errs: Record<string, string> = {}
    if (!form.signer_last_name.trim()) errs.signer_last_name = 'Введите фамилию'
    if (!form.signer_first_name.trim()) errs.signer_first_name = 'Введите имя'
    if (!form.signer_address_reg.trim()) errs.signer_address_reg = 'Укажите адрес регистрации'
    return errs
  }

  function goNext(nextStep: number, validate: () => Record<string, string>) {
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('[data-error="true"]')
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }
    setErrors({})
    setStep(nextStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function goBack(prevStep: number) {
    setErrors({})
    setStep(prevStep)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit() {
    if (!profile) return
    setSubmitting(true)
    await supabase.from('student_profiles').update({
      ...form,
      consents_signed_at: new Date().toISOString(),
      filled_at: new Date().toISOString(),
    }).eq('id', profile.id)

    if (form.father_name || form.father_phone) {
      await supabase.from('student_contacts').upsert({
        student_id: profile.student_id,
        name: form.father_name,
        role: 'папа',
        phone: form.father_phone || null,
      }, { onConflict: 'student_id,role' })
    }
    if (form.mother_name || form.mother_phone) {
      await supabase.from('student_contacts').upsert({
        student_id: profile.student_id,
        name: form.mother_name,
        role: 'мама',
        phone: form.mother_phone || null,
      }, { onConflict: 'student_id,role' })
    }
    setStep(99)
    setSubmitting(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!profile) return <div className="min-h-screen flex items-center justify-center text-gray-500 p-6 text-center"><div><div className="text-4xl mb-3">🔍</div><p>Анкета не найдена</p></div></div>

  // Шаг 99 — завершено
  if (step === 99) return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white flex flex-col items-center justify-center p-6 text-center">
      <div className="text-6xl mb-5">🥋</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-3">Анкета заполнена!</h1>
      <p className="text-gray-600 max-w-sm leading-relaxed">
        Спасибо! Все данные сохранены. Тренер сформирует договор — вы получите его на подпись при следующем посещении.
      </p>
    </div>
  )

  // Шаг 0 — вводный
  if (step === 0) return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white p-5 max-w-lg mx-auto">
      <div className="text-center pt-8 pb-6">
        <div className="text-5xl mb-3">🥋</div>
        <h1 className="text-xl font-bold text-gray-800">Школа Самурая</h1>
        <p className="text-gray-500 text-sm mt-1">Профиль ученика</p>
      </div>
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5 mb-5 space-y-3">
        <p className="font-semibold text-gray-800">Добро пожаловать в семью Школы Самурая! 🎉</p>
        <p className="text-sm text-gray-600 leading-relaxed">
          Чтобы мы могли оформить договор и максимально учесть всё важное для занятий, заполните анкету ученика. Это займёт 5–7 минут.
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5">📋</span>
            <span>Данные автоматически попадут в договор — не нужно ничего переписывать от руки</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5">👨‍👩‍👧</span>
            <span>Контакты родителей — чтобы мы всегда могли оперативно связаться</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5">📄</span>
            <span>Паспортные данные — для оформления договора об оказании услуг</span>
          </div>
          <div className="flex items-start gap-2 text-sm text-gray-700">
            <span className="mt-0.5">🎯</span>
            <span>Цели занятий — тренер учтёт их при составлении программы</span>
          </div>
        </div>
        <p className="text-xs text-gray-400">Данные защищены и используются только для работы Школы Самурая.</p>
      </div>
      <button onClick={() => setStep(1)} className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm">
        Начать →
      </button>
    </div>
  )

  // Шаг 1 — данные ученика
  if (step === 1) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <ProgressBar step={1} total={4} />
      <h2 className="text-lg font-bold text-gray-800 mb-4">Данные ученика</h2>
      <div className="space-y-3">
        {([
          ['last_name', 'Фамилия *'],
          ['first_name', 'Имя *'],
          ['middle_name', 'Отчество'],
        ] as [string, string][]).map(([key, label]) => (
          <div key={key} data-error={!!errors[key] || undefined}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <input
              value={(form as any)[key]}
              onChange={e => set(key, e.target.value)}
              className={inputClass(!!errors[key])}
            />
            <FieldError msg={errors[key]} />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Телефон ученика (личный, если есть)</label>
          <input type="tel" value={student?.phone || ''} disabled
            className="w-full border border-gray-100 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-500" />
          <p className="text-xs text-gray-400 mt-0.5">Зафиксирован при регистрации</p>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Telegram ученика (@никнейм)</label>
          <input value={form.student_telegram} onChange={e => set('student_telegram', e.target.value)}
            placeholder="@username"
            className={inputClass(false)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
            placeholder="example@mail.ru"
            className={inputClass(false)} />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Адрес проживания</label>
          <input value={form.address} onChange={e => set('address', e.target.value)}
            placeholder="ул. Ленина, д.1, кв.1"
            className={inputClass(false)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Школа / учебное заведение</label>
            <input value={form.school_name} onChange={e => set('school_name', e.target.value)}
              placeholder="Школа №1"
              className={inputClass(false)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Класс / курс</label>
            <input value={form.school_grade} onChange={e => set('school_grade', e.target.value)}
              placeholder="5А"
              className={inputClass(false)} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-2">Рост</label>
          <div className="flex gap-2">
            {HEIGHT_OPTIONS.map(h => (
              <button key={h.value} onClick={() => set('height_category', h.value)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors
                  ${form.height_category === h.value ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-600'}`}>
                {h.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">С какого месяца и года занимаешься в Школе Самурая?</label>
          <input
            type="month"
            value={form.training_start_date ? form.training_start_date.slice(0, 7) : ''}
            onChange={e => set('training_start_date', e.target.value ? e.target.value + '-01' : '')}
            className={inputClass(false)}
          />
          <p className="text-xs text-gray-400 mt-0.5">Примерно, если не помнишь точно</p>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button onClick={() => goBack(0)}
            className="px-5 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600">
            ← Назад
          </button>
          <button onClick={() => goNext(2, validateStep1)}
            className="flex-1 bg-black text-white py-3.5 rounded-2xl font-medium text-sm">
            Далее →
          </button>
        </div>
      </div>
    </div>
  )

  // Шаг 2 — контакты родителей
  if (step === 2) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <ProgressBar step={2} total={4} />
      <h2 className="text-lg font-bold text-gray-800 mb-1">Контакты родителей</h2>
      <p className="text-sm text-gray-500 mb-5">Для оперативной связи по вопросам занятий</p>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">👨 Отец</p>
          {([['father_name','ФИО отца','text'],['father_phone','Телефон','tel'],['father_telegram','Telegram (@никнейм)','text']] as [string,string,string][]).map(([key,label,type]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white" />
            </div>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.father_in_group} onChange={e => set('father_in_group', e.target.checked)}
              className="w-4 h-4 accent-black" />
            <span className="text-sm text-gray-600">Добавить в информационную группу Telegram</span>
          </label>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">👩 Мать</p>
          {([['mother_name','ФИО матери','text'],['mother_phone','Телефон','tel'],['mother_telegram','Telegram (@никнейм)','text']] as [string,string,string][]).map(([key,label,type]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => set(key, e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white" />
            </div>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.mother_in_group} onChange={e => set('mother_in_group', e.target.checked)}
              className="w-4 h-4 accent-black" />
            <span className="text-sm text-gray-600">Добавить в информационную группу Telegram</span>
          </label>
        </div>

        {/* Кто подписывает договор */}
        <div className={`rounded-2xl p-4 space-y-3 ${errors.contract_with ? 'bg-red-50 border border-red-200' : 'bg-blue-50'}`}
          data-error={!!errors.contract_with || undefined}>
          <p className="text-sm font-semibold text-gray-700">📄 Кто подписывает договор? *</p>
          <p className="text-xs text-gray-500">Договор об оказании услуг оформляется на законного представителя ребёнка</p>
          <div className="flex gap-2">
            {(['мама', 'папа', 'другой'] as const).map(val => (
              <button key={val} onClick={() => handleContractWith(val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize
                  ${form.contract_with === val ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600'}`}>
                {val === 'мама' ? '👩 Мама' : val === 'папа' ? '👨 Папа' : '👤 Другой'}
              </button>
            ))}
          </div>
          <FieldError msg={errors.contract_with} />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Как узнали о Школе Самурая?</label>
          <input value={form.referral_source} onChange={e => set('referral_source', e.target.value)}
            placeholder="Instagram, от знакомых, реклама..."
            className={inputClass(false)} />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button onClick={() => goBack(1)}
            className="px-5 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600">
            ← Назад
          </button>
          <button onClick={() => goNext(3, validateStep2)}
            className="flex-1 bg-black text-white py-3.5 rounded-2xl font-medium text-sm">
            Далее →
          </button>
        </div>
      </div>
    </div>
  )

  // Шаг 3 — данные для договора
  if (step === 3) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <ProgressBar step={3} total={4} />
      <h2 className="text-lg font-bold text-gray-800 mb-1">Данные для договора</h2>
      <p className="text-sm text-gray-500 mb-5">
        Подписант: <span className="font-medium text-gray-700 capitalize">{form.contract_with}</span>
      </p>

      {/* Паспортные данные подписанта */}
      <div className="space-y-3 mb-6">
        <p className="text-sm font-semibold text-gray-700">Данные подписанта договора</p>

        {([
          ['signer_last_name', 'Фамилия *'],
          ['signer_first_name', 'Имя *'],
          ['signer_middle_name', 'Отчество'],
        ] as [string, string][]).map(([key, label]) => (
          <div key={key} data-error={!!errors[key] || undefined}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <input value={(form as any)[key]} onChange={e => set(key, e.target.value)}
              className={inputClass(!!errors[key])} />
            <FieldError msg={errors[key]} />
          </div>
        ))}

        <div>
          <label className="text-xs text-gray-500 block mb-1">Дата рождения</label>
          <input type="date" value={form.signer_birth_date}
            onChange={e => set('signer_birth_date', e.target.value)}
            className={inputClass(false)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Серия паспорта</label>
            <input value={form.signer_passport_series}
              onChange={e => set('signer_passport_series', e.target.value)}
              placeholder="1234" maxLength={4}
              className={inputClass(false)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Номер паспорта</label>
            <input value={form.signer_passport_number}
              onChange={e => set('signer_passport_number', e.target.value)}
              placeholder="567890" maxLength={6}
              className={inputClass(false)} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Кем выдан</label>
          <input value={form.signer_passport_issued_by}
            onChange={e => set('signer_passport_issued_by', e.target.value)}
            placeholder="Отделом МВД России по г. ..."
            className={inputClass(false)} />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Дата выдачи паспорта</label>
          <input type="date" value={form.signer_passport_issued_date}
            onChange={e => set('signer_passport_issued_date', e.target.value)}
            className={inputClass(false)} />
        </div>

        <div data-error={!!errors.signer_address_reg || undefined}>
          <label className="text-xs text-gray-500 block mb-1">Адрес регистрации (прописки) *</label>
          <input value={form.signer_address_reg}
            onChange={e => set('signer_address_reg', e.target.value)}
            placeholder="г. Москва, ул. Ленина, д.1, кв.1"
            className={inputClass(!!errors.signer_address_reg)} />
          <FieldError msg={errors.signer_address_reg} />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Адрес фактического проживания</label>
          <input value={form.signer_address_fact}
            onChange={e => set('signer_address_fact', e.target.value)}
            placeholder="Если отличается от прописки"
            className={inputClass(false)} />
        </div>
      </div>

      {/* Документ ребёнка */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-700">Документ ребёнка</p>
        <div>
          <label className="text-xs text-gray-500 block mb-2">Тип документа</label>
          <div className="flex gap-2">
            {(['свидетельство', 'паспорт'] as const).map(val => (
              <button key={val} onClick={() => set('child_doc_type', val)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors
                  ${form.child_doc_type === val ? 'bg-black text-white border-black' : 'bg-white border-gray-200 text-gray-600'}`}>
                {val === 'свидетельство' ? '📜 Свидетельство о рождении' : '🪪 Паспорт'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">Свидетельство — до 14 лет, паспорт — с 14 лет</p>
        </div>

        {form.child_doc_type && (
          <>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Серия и номер</label>
              <input value={form.child_doc_number}
                onChange={e => set('child_doc_number', e.target.value)}
                placeholder={form.child_doc_type === 'свидетельство' ? 'I-АБ 123456' : '1234 567890'}
                className={inputClass(false)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Кем выдан</label>
              <input value={form.child_doc_issued_by}
                onChange={e => set('child_doc_issued_by', e.target.value)}
                placeholder={form.child_doc_type === 'свидетельство' ? 'Отдел ЗАГС ...' : 'Отдел МВД России ...'}
                className={inputClass(false)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Дата выдачи</label>
              <input type="date" value={form.child_doc_issued_date}
                onChange={e => set('child_doc_issued_date', e.target.value)}
                className={inputClass(false)} />
            </div>
          </>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button onClick={() => goBack(2)}
            className="px-5 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600">
            ← Назад
          </button>
          <button onClick={() => goNext(4, validateStep3)}
            className="flex-1 bg-black text-white py-3.5 rounded-2xl font-medium text-sm">
            Далее →
          </button>
        </div>
      </div>
    </div>
  )

  // Шаг 4 — цели + согласия
  if (step === 4) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-28">
      <ProgressBar step={4} total={4} />
      <h2 className="text-lg font-bold text-gray-800 mb-1">Цели занятий</h2>
      <p className="text-sm text-gray-500 mb-4">Выберите всё, что важно для вас (можно несколько)</p>

      <div className="space-y-2 mb-6">
        {GOALS.map(goal => (
          <button key={goal} onClick={() => toggleGoal(goal)}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm border transition-colors
              ${form.goals.includes(goal) ? 'bg-black text-white border-black' : 'border-gray-200 text-gray-700'}`}>
            {form.goals.includes(goal) ? '✓ ' : ''}{goal}
          </button>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 space-y-3 mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-1">Подтверждение</p>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.consent_rules} onChange={e => set('consent_rules', e.target.checked)}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Ознакомлен(а) с <strong>Правилами посещения</strong> Центра ФРиС «Школа Самурая» и обязуюсь их соблюдать</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.consent_contract} onChange={e => set('consent_contract', e.target.checked)}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Ознакомлен(а) с условиями <strong>Договора на приобретение абонемента</strong> и принимаю их</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.consent_personal_data} onChange={e => set('consent_personal_data', e.target.checked)}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Согласен(а) на <strong>обработку персональных данных</strong> согласно 152-ФЗ в целях оказания услуг Центром ФРиС</span>
        </label>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button onClick={() => goBack(3)}
            className="px-5 py-3.5 rounded-2xl border border-gray-200 text-sm font-medium text-gray-600">
            ← Назад
          </button>
          <button onClick={submit} disabled={submitting || !form.consent_rules || !form.consent_contract || !form.consent_personal_data}
            className="flex-1 bg-black text-white py-3.5 rounded-2xl font-medium text-sm disabled:opacity-40">
            {submitting ? 'Сохраняю...' : 'Отправить анкету ✓'}
          </button>
        </div>
      </div>
    </div>
  )

  return null
}
