'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function PrintInstallmentPage() {
  const { planId } = useParams<{ planId: string }>()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: plan } = await supabase
        .from('installment_plans')
        .select(`
          *,
          installment_payments ( * ),
          subscriptions (
            type, amount, start_date, end_date,
            students ( name, birth_date, phone, parent_name, parent_phone, address )
          )
        `)
        .eq('id', planId)
        .single()
      setData(plan)
      setLoading(false)
    }
    load()
  }, [planId])

  if (loading) return <div className="p-8 text-gray-400">Загрузка...</div>
  if (!data) return <div className="p-8 text-gray-500">Рассрочка не найдена</div>

  const student = data.subscriptions?.students
  const sub = data.subscriptions
  const payments = [...(data.installment_payments || [])].sort((a: any, b: any) => a.due_date.localeCompare(b.due_date))
  const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  const createdAt = new Date(data.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12pt; }
        }
        body { font-family: 'Times New Roman', serif; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #333; padding: 6px 10px; }
        th { background: #f5f5f5; }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50">
        <button onClick={() => window.print()}
          className="bg-black text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg hover:bg-gray-800">
          🖨 Печать / PDF
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 30px', color: '#111' }}>
        {/* Шапка */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
            АНО «Вакикай»
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Клуб боевых искусств «Самурай»</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', marginTop: 16, textDecoration: 'underline' }}>
            ПРИЛОЖЕНИЕ К ДОГОВОРУ ОБ ОТСРОЧКЕ ПЛАТЕЖА
          </div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            г. Уфа, {createdAt}
          </div>
        </div>

        {/* Стороны */}
        <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
          <p>
            АНО «Вакикай» в лице директора, именуемое в дальнейшем <b>«Исполнитель»</b>, с одной стороны, и
          </p>
          <p>
            <b>{student?.parent_name || student?.name || '___________'}</b>
            {student?.parent_name ? ` (родитель/законный представитель ученика ${student?.name})` : ''},
            именуемый(-ая) в дальнейшем <b>«Заказчик»</b>, с другой стороны,
          </p>
          <p>
            совместно именуемые <b>«Стороны»</b>, заключили настоящее Приложение о нижеследующем:
          </p>
        </div>

        {/* Предмет */}
        <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
          <b>1. ПРЕДМЕТ ПРИЛОЖЕНИЯ</b>
          <p>
            1.1. Стороны договорились о предоставлении Заказчику отсрочки оплаты услуг по абонементу
            «<b>{sub?.type?.includes('|') ? sub.type.split('|')[1] : sub?.type}</b>»
            на общую сумму <b>{data.total_amount?.toLocaleString('ru-RU')} ₽</b>.
          </p>
          <p>
            1.2. Первоначальный взнос в размере <b>{data.deposit_amount?.toLocaleString('ru-RU')} ₽</b>
            {data.deposit_paid_at ? ` внесён « ${data.deposit_paid_at} »` : ' вносится в момент подписания'}.
          </p>
          <p>
            1.3. Оставшаяся сумма <b>{(data.total_amount - data.deposit_amount).toLocaleString('ru-RU')} ₽</b> выплачивается
            согласно графику платежей, указанному в разделе 2 настоящего Приложения.
          </p>
        </div>

        {/* График платежей */}
        <div style={{ marginBottom: 16, fontSize: 13 }}>
          <b>2. ГРАФИК ПЛАТЕЖЕЙ</b>
          <table style={{ marginTop: 10 }}>
            <thead>
              <tr>
                <th style={{ width: 40 }}>№</th>
                <th>Дата платежа</th>
                <th>Сумма (₽)</th>
                <th>Отметка об оплате</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center' }}>—</td>
                <td>Первоначальный взнос ({data.deposit_paid_at ?? '___________'})</td>
                <td style={{ textAlign: 'right' }}>{data.deposit_amount?.toLocaleString('ru-RU')}</td>
                <td style={{ textAlign: 'center' }}>✓</td>
              </tr>
              {payments.map((p: any, i: number) => (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center' }}>{i + 1}</td>
                  <td>{new Date(p.due_date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
                  <td style={{ textAlign: 'right' }}>{p.amount?.toLocaleString('ru-RU')}</td>
                  <td style={{ textAlign: 'center' }}>
                    {p.status === 'paid' ? `✓ ${p.paid_at ?? ''}` : ''}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} style={{ textAlign: 'right', fontWeight: 'bold' }}>Итого:</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{data.total_amount?.toLocaleString('ru-RU')}</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Условия */}
        <div style={{ marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
          <b>3. УСЛОВИЯ ОТСРОЧКИ</b>
          <p>
            3.1. В случае нарушения сроков оплаты более чем на <b>{data.grace_period_days ?? 5} (пять) календарных дней</b>
            Исполнитель вправе приостановить оказание услуг до погашения задолженности.
          </p>
          <p>
            3.2. Заказчик обязуется уведомлять Исполнителя о возможных задержках платежа заблаговременно.
          </p>
          <p>
            3.3. Настоящее Приложение является неотъемлемой частью Договора об оказании услуг.
          </p>
        </div>

        {/* Подписи */}
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <div style={{ width: '45%' }}>
            <div><b>ИСПОЛНИТЕЛЬ:</b></div>
            <div style={{ marginTop: 8 }}>АНО «Вакикай»</div>
            <div style={{ marginTop: 24, borderTop: '1px solid #333', paddingTop: 4 }}>
              Подпись / Директор
            </div>
          </div>
          <div style={{ width: '45%' }}>
            <div><b>ЗАКАЗЧИК:</b></div>
            <div style={{ marginTop: 8 }}>{student?.parent_name || student?.name || '___________'}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
              {student?.parent_phone || student?.phone || ''}
            </div>
            <div style={{ marginTop: 16, borderTop: '1px solid #333', paddingTop: 4 }}>
              Подпись
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
