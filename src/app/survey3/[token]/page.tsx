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

export default function Survey3Page() {
  const { token } = useParams<{ token: string }>()
  const [profile, setProfile] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState({
    last_name: '', first_name: '', middle_name: '',
    student_telegram: '', email: '',
    address: '', school_name: '', school_grade: '',
    height_category: '',
    father_name: '', father_phone: '', father_telegram: '', father_in_group: false,
    mother_name: '', mother_phone: '', mother_telegram: '', mother_in_group: false,
    training_start_date: '',
    referral_source: '',
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
          // Pre-fill existing data
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
            father_name: data.father_name || '',
            father_phone: data.father_phone || '',
            father_telegram: data.father_telegram || '',
            father_in_group: data.father_in_group || false,
            mother_name: data.mother_name || '',
            mother_phone: data.mother_phone || '',
            mother_telegram: data.mother_telegram || '',
            mother_in_group: data.mother_in_group || false,
            training_start_date: data.training_start_date || '',
            referral_source: data.referral_source || '',
            goals: data.goals || [],
          }))
        }
        setLoading(false)
      })
  }, [token])

  function toggleGoal(goal: string) {
    setForm(f => ({
      ...f,
      goals: f.goals.includes(goal) ? f.goals.filter(g => g !== goal) : [...f.goals, goal],
    }))
  }

  async function submit() {
    if (!profile) return
    if (!form.consent_rules || !form.consent_contract || !form.consent_personal_data) {
      alert('Пожалуйста, подтвердите все три пункта внизу')
      return
    }
    setSubmitting(true)
    await supabase.from('student_profiles').update({
      ...form,
      consents_signed_at: new Date().toISOString(),
      filled_at: new Date().toISOString(),
    }).eq('id', profile.id)

    // Создаём контакты родителей
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
          Чтобы мы могли оформить договор и максимально учесть всё важное для занятий, заполните анкету ученика. Это займёт 4–5 минут.
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
      <div className="mb-5">
        <div className="flex gap-1.5 mb-1">
          {[0,1,2].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i === 0 ? 'bg-black' : 'bg-gray-200'}`} />)}
        </div>
        <p className="text-xs text-gray-400 text-right">Шаг 1 из 3</p>
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-4">Данные ученика</h2>
      <div className="space-y-3">
        {[
          ['last_name', 'Фамилия *', 'text'],
          ['first_name', 'Имя *', 'text'],
          ['middle_name', 'Отчество', 'text'],
        ].map(([key, label]) => (
          <div key={key}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <input value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400" />
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
          <input value={form.student_telegram} onChange={e => setForm(f => ({...f, student_telegram: e.target.value}))}
            placeholder="@username"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
            placeholder="example@mail.ru"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Адрес проживания</label>
          <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
            placeholder="ул. Ленина, д.1, кв.1"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Школа / учебное заведение</label>
            <input value={form.school_name} onChange={e => setForm(f => ({...f, school_name: e.target.value}))}
              placeholder="Школа №1"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Класс / курс</label>
            <input value={form.school_grade} onChange={e => setForm(f => ({...f, school_grade: e.target.value}))}
              placeholder="5А"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-2">Рост</label>
          <div className="flex gap-2">
            {HEIGHT_OPTIONS.map(h => (
              <button key={h.value} onClick={() => setForm(f => ({...f, height_category: h.value}))}
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
            onChange={e => setForm(f => ({ ...f, training_start_date: e.target.value ? e.target.value + '-01' : '' }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-gray-400"
          />
          <p className="text-xs text-gray-400 mt-0.5">Примерно, если не помнишь точно</p>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={() => { if (!form.last_name || !form.first_name) { alert('Заполните фамилию и имя'); return } setStep(2) }}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm max-w-lg mx-auto block">
          Далее →
        </button>
      </div>
    </div>
  )

  // Шаг 2 — контакты родителей
  if (step === 2) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-24">
      <div className="mb-5">
        <div className="flex gap-1.5 mb-1">
          {[0,1,2].map(i => <div key={i} className={`h-1 flex-1 rounded-full ${i <= 1 ? 'bg-black' : 'bg-gray-200'}`} />)}
        </div>
        <p className="text-xs text-gray-400 text-right">Шаг 2 из 3</p>
      </div>
      <h2 className="text-lg font-bold text-gray-800 mb-1">Контакты родителей</h2>
      <p className="text-sm text-gray-500 mb-5">Для оперативной связи по вопросам занятий</p>

      <div className="space-y-4">
        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">👨 Отец</p>
          {[['father_name','ФИО отца','text'],['father_phone','Телефон','tel'],['father_telegram','Telegram (@никнейм)','text']].map(([key,label,type]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white" />
            </div>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.father_in_group} onChange={e => setForm(f => ({...f, father_in_group: e.target.checked}))}
              className="w-4 h-4 accent-black" />
            <span className="text-sm text-gray-600">Добавить в информационную группу Telegram</span>
          </label>
        </div>

        <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">👩 Мать</p>
          {[['mother_name','ФИО матери','text'],['mother_phone','Телефон','tel'],['mother_telegram','Telegram (@никнейм)','text']].map(([key,label,type]) => (
            <div key={key}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input type={type} value={(form as any)[key]} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white" />
            </div>
          ))}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.mother_in_group} onChange={e => setForm(f => ({...f, mother_in_group: e.target.checked}))}
              className="w-4 h-4 accent-black" />
            <span className="text-sm text-gray-600">Добавить в информационную группу Telegram</span>
          </label>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Как узнали о Школе Самурая?</label>
          <input value={form.referral_source} onChange={e => setForm(f => ({...f, referral_source: e.target.value}))}
            placeholder="Instagram, от знакомых, реклама..."
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none" />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={() => setStep(3)}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm max-w-lg mx-auto block">
          Далее →
        </button>
      </div>
    </div>
  )

  // Шаг 3 — цели + согласия
  if (step === 3) return (
    <div className="min-h-screen bg-white p-5 max-w-lg mx-auto pb-28">
      <div className="mb-5">
        <div className="flex gap-1.5 mb-1">
          {[0,1,2].map(i => <div key={i} className="h-1 flex-1 rounded-full bg-black" />)}
        </div>
        <p className="text-xs text-gray-400 text-right">Шаг 3 из 3</p>
      </div>
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
          <input type="checkbox" checked={form.consent_rules} onChange={e => setForm(f => ({...f, consent_rules: e.target.checked}))}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Ознакомлен(а) с <strong>Правилами посещения</strong> Центра ФРиС «Школа Самурая» и обязуюсь их соблюдать</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.consent_contract} onChange={e => setForm(f => ({...f, consent_contract: e.target.checked}))}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Ознакомлен(а) с условиями <strong>Договора на приобретение абонемента</strong> и принимаю их</span>
        </label>
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={form.consent_personal_data} onChange={e => setForm(f => ({...f, consent_personal_data: e.target.checked}))}
            className="w-4 h-4 accent-black mt-0.5 shrink-0" />
          <span className="text-sm text-gray-600">Согласен(а) на <strong>обработку персональных данных</strong> согласно 152-ФЗ в целях оказания услуг Центром ФРиС</span>
        </label>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <button onClick={submit} disabled={submitting || !form.consent_rules || !form.consent_contract || !form.consent_personal_data}
          className="w-full bg-black text-white py-3.5 rounded-2xl font-medium text-sm max-w-lg mx-auto block disabled:opacity-40">
          {submitting ? 'Сохраняю...' : 'Отправить анкету ✓'}
        </button>
      </div>
    </div>
  )

  return null
}
