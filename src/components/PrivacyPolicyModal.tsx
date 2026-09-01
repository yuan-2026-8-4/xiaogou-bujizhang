import { useState } from 'react'

// 隐私政策弹窗（上架合规要求：应用商店审核必需）
// 运营主体：四川杰曜显安品牌管理有限公司
export default function PrivacyPolicyModal({
  onClose,
  onAgree,
}: {
  onClose: () => void
  onAgree?: () => void
}) {
  const [tab, setTab] = useState<'privacy' | 'terms'>('privacy')

  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-box policy-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">用户协议与隐私政策</div>

        <div className="policy-tabs">
          <button className={tab === 'privacy' ? 'active' : ''} onClick={() => setTab('privacy')}>
            隐私政策
          </button>
          <button className={tab === 'terms' ? 'active' : ''} onClick={() => setTab('terms')}>
            用户协议
          </button>
        </div>

        <div className="policy-content">
          {tab === 'privacy' ? (
            <>
              <p>
                「小狗不记账」（以下简称"本应用"）由四川杰曜显安品牌管理有限公司（以下简称"我们"）运营。我们深知个人信息对你的重要性，将以高度审慎的态度处理你的个人信息。
              </p>
              <h4>一、我们收集的信息</h4>
              <p>1. 账户信息：注册时收集邮箱地址、密码（加密存储）及你设置的昵称。</p>
              <p>2. 记账数据：你主动录入的账单内容（金额、分类、备注、日期）。</p>
              <p>3. 设备信息：为保障服务安全，收集必要的设备型号、操作系统版本。</p>
              <h4>二、信息的使用</h4>
              <p>1. 你的记账数据仅用于向你提供记账、统计、多人协同服务。</p>
              <p>
                2. 协同账本中，账单数据仅对同一账本的成员可见。你可随时退出协同账本。
              </p>
              <p>3. 我们不会将你的个人信息出售、共享给任何第三方（法律法规要求除外）。</p>
              <h4>三、信息的存储</h4>
              <p>1. 数据存储于符合安全标准的云服务器（Supabase）。</p>
              <p>2. 我们采用传输加密与访问控制保护你的数据安全。</p>
              <h4>四、你的权利</h4>
              <p>1. 查询、更正：你可随时在"我的"页面查看和修改个人资料。</p>
              <p>2. 删除：你可删除任意账单、账本，或在"设置 → 账号与安全"中申请注销账号，注销后云端个人数据将被全部删除。</p>
              <p>3. 卸载应用后，我们不会继续收集你的信息。</p>
              <h4>五、未成年人保护</h4>
              <p>本应用面向成年人。若为未满 14 周岁的未成年人使用，需监护人同意并代为阅读本政策。</p>
              <h4>六、政策更新</h4>
              <p>政策重大变更时，我们将在应用内显著位置通知你。</p>
              <p className="policy-date">更新日期：2026 年 8 月 30 日</p>
            </>
          ) : (
            <>
              <p>欢迎使用「小狗不记账」。在使用前，请仔细阅读并理解本协议。</p>
              <h4>一、服务说明</h4>
              <p>本应用提供个人记账与多人协同记账服务，基础功能免费使用。</p>
              <h4>二、用户行为规范</h4>
              <p>1. 不得利用本应用从事违法违规活动。</p>
              <p>2. 协同账本中不得录入、分享违法或侵犯他人权利的内容。</p>
              <p>3. 妥善保管账号密码，因保管不善造成的损失由用户自行承担。</p>
              <h4>三、知识产权</h4>
              <p>本应用的界面设计、代码及相关内容的知识产权归四川杰曜显安品牌管理有限公司所有。</p>
              <h4>四、免责声明</h4>
              <p>因不可抗力、网络故障、系统维护等原因导致服务中断或数据异常的，我们不承担赔偿责任，但将尽力恢复并减少损失。</p>
              <h4>五、协议终止</h4>
              <p>你注销账号或我们依据规则终止服务时，本协议终止。协议终止后，我们将依法处理你的个人数据。</p>
              <p className="policy-date">更新日期：2026 年 8 月 30 日</p>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>
            {onAgree ? '不同意' : '关闭'}
          </button>
          {onAgree && (
            <button className="btn-primary" onClick={onAgree}>
              同意
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
