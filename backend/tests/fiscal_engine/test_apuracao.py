"""Testes da apuração agregada de IBS/CBS (``fiscal_engine.apuracao``).

Contrato F0.7b — casos de apuração, saldos separados por tributo, índices,
contagens de conformidade, drill-down de inconformidades e helpers internos.
Fixtures SINTÉTICAS (sem dado real de cliente / LGPD).
"""

from collections.abc import Callable
from datetime import date
from decimal import Decimal

import pytest

from fiscal_engine.apuracao import (
    _compute_index,
    _iter_assessable_units,
    _quantize_money,
    apurar,
)
from fiscal_engine.enums import (
    ConformityReason,
    Direction,
    DocumentType,
    Granularity,
    TaxRegime,
)
from fiscal_engine.models import Apuracao, FiscalDocument, FiscalItem, InconformidadeRef
from tests.fiscal_engine.conftest import (
    SYNTHETIC_ACCESS_KEY,
    synthetic_access_key,
)

PERIODO_INICIO = date(2026, 1, 1)
PERIODO_FIM = date(2026, 1, 31)
ZERO = Decimal("0")


def _apurar_mensal(documents: list[FiscalDocument]) -> Apuracao:
    """Atalho: apura em granularidade MENSAL no período-âncora de janeiro/2026."""
    return apurar(
        documents,
        period_start=PERIODO_INICIO,
        period_end=PERIODO_FIM,
        granularity=Granularity.MONTHLY,
    )


# --- Caso 1: compra normal (INBOUND com destaque) -> crédito -----------------
def test_caso1_compra_normal_gera_credito(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(direction=Direction.INBOUND, tax_regime=TaxRegime.RPA)
    result = _apurar_mensal([doc])
    assert result.creditos_ibs == Decimal("8.80")
    assert result.creditos_cbs == Decimal("0.90")
    assert result.creditos == Decimal("9.70")
    assert result.debitos == Decimal("0.00")
    assert result.saldo_ibs == Decimal("8.80")
    assert result.saldo == Decimal("9.70")
    assert result.base_entradas == Decimal("100.00")
    assert result.base_saidas == Decimal("0.00")
    assert result.idx_credito_entradas == Decimal("9.70")
    assert result.idx_debito_saidas is None  # base de saídas zero
    assert result.conforme_count == 1
    assert result.inconformidade_count == 0
    assert result.nao_avaliado_count == 0
    assert result.documentos_count == 1
    assert result.itens_count == 1
    assert result.inconformidades == ()
    # Metadados preservados.
    assert result.period_start == PERIODO_INICIO
    assert result.period_end == PERIODO_FIM
    assert result.granularity == Granularity.MONTHLY


# --- Caso 2: venda normal (OUTBOUND com destaque) -> débito ------------------
def test_caso2_venda_normal_gera_debito(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(direction=Direction.OUTBOUND, tax_regime=TaxRegime.RPA)
    result = _apurar_mensal([doc])
    assert result.debitos_ibs == Decimal("8.80")
    assert result.debitos_cbs == Decimal("0.90")
    assert result.debitos == Decimal("9.70")
    assert result.creditos == Decimal("0.00")
    assert result.saldo == Decimal("-9.70")
    assert result.base_saidas == Decimal("100.00")
    assert result.idx_debito_saidas == Decimal("9.70")
    assert result.idx_saldo_saidas == Decimal("-9.70")
    assert result.idx_credito_entradas is None
    assert result.conforme_count == 1


# --- Caso 3: saldos SEPARADOS por tributo + índices (HALF_UP, sinal) ---------
def test_caso3_saldos_separados_e_indices(
    make_document: Callable[..., FiscalDocument],
) -> None:
    entrada = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(1),
        cfop="5102",
        v_bc_ibscbs=Decimal("1000.00"),
        v_ibs=Decimal("60.00"),
        v_cbs=Decimal("45.00"),
        items=(),
    )
    saida = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(2),
        cfop="5102",
        v_bc_ibscbs=Decimal("900.00"),
        v_ibs=Decimal("40.00"),
        v_cbs=Decimal("90.00"),
        items=(),
    )
    result = _apurar_mensal([entrada, saida])

    # Eixos canônicos (não cruzam IBS x CBS).
    assert result.creditos_ibs == Decimal("60.00")
    assert result.creditos_cbs == Decimal("45.00")
    assert result.debitos_ibs == Decimal("40.00")
    assert result.debitos_cbs == Decimal("90.00")
    assert result.saldo_ibs == Decimal("20.00")  # credor
    assert result.saldo_cbs == Decimal("-45.00")  # devedor

    # Agregados (exibição).
    assert result.creditos == Decimal("105.00")
    assert result.debitos == Decimal("130.00")
    assert result.saldo == Decimal("-25.00")

    # Bases.
    assert result.base_entradas == Decimal("1000.00")
    assert result.base_saidas == Decimal("900.00")

    # Índices (pontos percentuais).
    assert result.idx_credito_entradas == Decimal("10.50")
    assert result.idx_debito_saidas == Decimal("14.44")  # 130/900 = 14.4444 -> HALF_UP
    assert result.idx_saldo_saidas == Decimal("-2.78")  # -25/900 = -2.7777 -> -2.78
    assert result.idx_saldo_saidas_ibs == Decimal("2.22")  # +20/900 = 2.2222 -> 2.22
    assert result.idx_saldo_saidas_cbs == Decimal("-5.00")  # -45/900 = -5.00


# --- CT-e doc-level: crédito de frete sem linhas de item --------------------
def test_cte_doc_level_credito_de_frete(
    make_document: Callable[..., FiscalDocument],
) -> None:
    cte = make_document(
        document_type=DocumentType.CTE,
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(3),
        cfop="1351",  # CT-e tomador (não excluído)
        v_bc_ibscbs=Decimal("200.00"),
        v_ibs=Decimal("10.00"),
        v_cbs=Decimal("2.00"),
        items=(),
    )
    result = _apurar_mensal([cte])
    assert result.documentos_count == 1
    assert result.itens_count == 1  # 1 unidade doc-level
    assert result.creditos_ibs == Decimal("10.00")
    assert result.creditos_cbs == Decimal("2.00")
    assert result.creditos == Decimal("12.00")
    assert result.base_entradas == Decimal("200.00")
    assert result.idx_credito_entradas == Decimal("6.00")
    assert result.conforme_count == 1


# --- Simples NACIONAL inbound sem destaque: entra na base, sem crédito -------
def test_simples_inbound_sem_destaque_entra_na_base_sem_credito(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.SIMPLES_NACIONAL,
        cfop="5102",
        v_bc_ibscbs=Decimal("100.00"),
        v_ibs=ZERO,
        v_cbs=ZERO,
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.creditos == Decimal("0.00")
    assert result.base_entradas == Decimal("100.00")
    # Índice 0.00 (NÃO None): há base, mas crédito zero — distinto de "sem base".
    assert result.idx_credito_entradas == Decimal("0.00")
    assert result.conforme_count == 1  # REGIME_SIMPLES
    assert result.inconformidade_count == 0


# --- RPA saída sem destaque: entra na base, sem débito, INCONFORMIDADE -------
def test_rpa_saida_sem_destaque_base_sem_debito_e_inconformidade(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(9),
        cfop="5102",
        v_bc_ibscbs=Decimal("300.00"),
        v_ibs=ZERO,
        v_cbs=ZERO,
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.debitos == Decimal("0.00")
    assert result.base_saidas == Decimal("300.00")
    assert result.idx_debito_saidas == Decimal("0.00")
    assert result.inconformidade_count == 1
    assert result.inconformidades == (
        InconformidadeRef(
            access_key=synthetic_access_key(9),
            item_number=1,
            direction=Direction.OUTBOUND,
            cfop="5102",
            reason=ConformityReason.RPA_SEM_DESTAQUE,
        ),
    )


# --- Simples em EXCESSO saída sem destaque: INCONFORMIDADE (drill-down ref) ---
def test_simples_excesso_saida_gera_inconformidade_ref(
    make_document: Callable[..., FiscalDocument],
) -> None:
    # LC 214/2025 (regime de transição): o contribuinte do Simples que ultrapassa
    # o sublimite passa a apurar IBS/CBS POR FORA — logo, saída comercial sem
    # destaque é candidata a inconformidade, como no RPA (≠ SIMPLES_NACIONAL).
    doc = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.SIMPLES_EXCESSO,
        access_key=synthetic_access_key(11),
        issue_date=date(2026, 5, 15),  # dentro da vigência RTC (LC 214/2025)
        cfop="5102",
        v_bc_ibscbs=Decimal("400.00"),
        v_ibs=ZERO,
        v_cbs=ZERO,
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.inconformidade_count == 1
    assert len(result.inconformidades) == 1
    ref = result.inconformidades[0]
    assert isinstance(ref, InconformidadeRef)
    assert ref.reason == ConformityReason.SIMPLES_EXCESSO_SEM_DESTAQUE
    # Drill-down rastreável até a unidade-origem do indício.
    assert ref.access_key == synthetic_access_key(11)
    assert ref.item_number == 1
    assert ref.direction == Direction.OUTBOUND
    assert ref.cfop == "5102"


# --- RPA ENTRADA sem destaque: entra na base, sem crédito, INCONFORMIDADE -----
def test_rpa_entrada_sem_destaque_base_sem_credito_e_inconformidade(
    make_document: Callable[..., FiscalDocument],
) -> None:
    # Espelho INBOUND do caso de saída: o veredito é direction-simétrico
    # (NO_HIGHLIGHT + RPA → RPA_SEM_DESTAQUE), mas a base soma em ENTRADAS e o
    # impacto NEUTRAL não gera crédito (v_ibs=v_cbs=0).
    doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(12),
        cfop="5102",
        v_bc_ibscbs=Decimal("300.00"),
        v_ibs=ZERO,
        v_cbs=ZERO,
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.base_entradas > ZERO
    assert result.base_entradas == Decimal("300.00")
    assert result.creditos == Decimal("0.00")
    # Índice 0.00 (NÃO None): há base de entradas, mas crédito zero.
    assert result.idx_credito_entradas == Decimal("0.00")
    assert result.inconformidade_count == 1
    assert result.inconformidades == (
        InconformidadeRef(
            access_key=synthetic_access_key(12),
            item_number=1,
            direction=Direction.INBOUND,
            cfop="5102",
            reason=ConformityReason.RPA_SEM_DESTAQUE,
        ),
    )


# --- Fora do universo financeiro: exportação / não-comercial / sem direção ---
@pytest.mark.parametrize(
    ("direction", "cfop", "expected_conforme", "expected_nao_avaliado"),
    [
        # Exportação imune -> CONFORME, mas não soma em base/crédito/débito.
        (Direction.OUTBOUND, "7101", 1, 0),
        # Remessa (não-comercial) -> NAO_AVALIADO, fora do universo financeiro.
        (Direction.OUTBOUND, "5910", 0, 1),
        # Direção desconhecida -> NAO_AVALIADO, fora do universo financeiro.
        (Direction.UNKNOWN, "5102", 0, 1),
    ],
)
def test_fora_do_universo_financeiro_nao_movimenta_dinheiro(
    make_document: Callable[..., FiscalDocument],
    direction: Direction,
    cfop: str,
    expected_conforme: int,
    expected_nao_avaliado: int,
) -> None:
    doc = make_document(
        direction=direction,
        tax_regime=TaxRegime.RPA,
        cfop=cfop,
        v_bc_ibscbs=Decimal("500.00"),
        v_ibs=Decimal("8.80"),
        v_cbs=Decimal("0.90"),
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.creditos == Decimal("0.00")
    assert result.debitos == Decimal("0.00")
    assert result.base_entradas == Decimal("0.00")
    assert result.base_saidas == Decimal("0.00")
    assert result.itens_count == 1
    assert result.conforme_count == expected_conforme
    assert result.nao_avaliado_count == expected_nao_avaliado
    assert result.inconformidade_count == 0


# --- Documento com ITENS mistos: crédito (item comercial) + excluído ---------
def test_documento_com_itens_mistos(
    make_document: Callable[..., FiscalDocument],
    make_item: Callable[..., FiscalItem],
) -> None:
    item_credito = make_item(
        item_number=1,
        cfop="5102",
        v_bc=Decimal("100.00"),
        v_ibs=Decimal("8.80"),
        v_cbs=Decimal("0.90"),
    )
    item_excluido = make_item(
        item_number=2,
        cfop="5910",
        v_bc=Decimal("50.00"),
        v_ibs=Decimal("4.40"),
        v_cbs=Decimal("0.45"),
    )
    doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        items=(item_credito, item_excluido),
    )
    result = _apurar_mensal([doc])
    assert result.itens_count == 2  # 1 unidade por item
    # Só o item comercial entra em crédito e base.
    assert result.creditos == Decimal("9.70")
    assert result.base_entradas == Decimal("100.00")
    assert result.conforme_count == 1  # item de crédito (DESTAQUE_PRESENTE)
    assert result.nao_avaliado_count == 1  # item excluído (NAO_COMERCIAL)


# --- Vazio: tudo 0.00, índices None, contagens 0 ----------------------------
def test_apurar_vazio_zera_tudo() -> None:
    result = apurar(
        [],
        period_start=None,
        period_end=None,
        granularity=Granularity.QUARTERLY,
    )
    for valor in (
        result.creditos_ibs,
        result.creditos_cbs,
        result.debitos_ibs,
        result.debitos_cbs,
        result.saldo_ibs,
        result.saldo_cbs,
        result.creditos,
        result.debitos,
        result.saldo,
        result.base_entradas,
        result.base_saidas,
    ):
        assert valor == Decimal("0.00")
    for indice in (
        result.idx_credito_entradas,
        result.idx_debito_saidas,
        result.idx_saldo_saidas,
        result.idx_saldo_saidas_ibs,
        result.idx_saldo_saidas_cbs,
    ):
        assert indice is None
    assert result.conforme_count == 0
    assert result.inconformidade_count == 0
    assert result.nao_avaliado_count == 0
    assert result.documentos_count == 0
    assert result.itens_count == 0
    assert result.inconformidades == ()
    assert result.period_start is None
    assert result.period_end is None
    assert result.granularity == Granularity.QUARTERLY


# --- NÃO deduplica: 2 docs com a MESMA access_key DOBRAM tudo ----------------
def test_apurar_nao_deduplica_mesma_access_key(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=SYNTHETIC_ACCESS_KEY,
        cfop="5102",
        v_bc_ibscbs=Decimal("100.00"),
        v_ibs=Decimal("8.80"),
        v_cbs=Decimal("0.90"),
        items=(),
    )
    result = _apurar_mensal([doc, doc])  # MESMA chave duas vezes
    assert result.debitos_ibs == Decimal("17.60")  # dobrado
    assert result.debitos_cbs == Decimal("1.80")
    assert result.debitos == Decimal("19.40")
    assert result.base_saidas == Decimal("200.00")
    assert result.documentos_count == 2
    assert result.itens_count == 2


# --- Multi-documento: contagens e InconformidadeRef corretos -----------------
def test_multi_doc_contagens_e_inconformidades(
    make_document: Callable[..., FiscalDocument],
    make_item: Callable[..., FiscalItem],
) -> None:
    item_a = make_item(item_number=1, cfop="5102", v_ibs=Decimal("8.80"), v_cbs=Decimal("0.90"))
    item_b = make_item(item_number=2, cfop="5102", v_ibs=Decimal("4.40"), v_cbs=Decimal("0.45"))
    conforme_doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(1),
        items=(item_a, item_b),
    )
    item_inc = make_item(item_number=5, cfop="5102", v_ibs=ZERO, v_cbs=ZERO, v_bc=Decimal("300.00"))
    inconforme_doc = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(2),
        cfop="5102",
        items=(item_inc,),
    )
    nao_aval_doc = make_document(
        direction=Direction.UNKNOWN,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(3),
        items=(make_item(item_number=1),),
    )
    result = _apurar_mensal([conforme_doc, inconforme_doc, nao_aval_doc])

    assert result.documentos_count == 3
    assert result.itens_count == 4  # 2 + 1 + 1
    assert result.conforme_count == 2
    assert result.inconformidade_count == 1
    assert result.nao_avaliado_count == 1
    assert result.inconformidades == (
        InconformidadeRef(
            access_key=synthetic_access_key(2),
            item_number=5,
            direction=Direction.OUTBOUND,
            cfop="5102",
            reason=ConformityReason.RPA_SEM_DESTAQUE,
        ),
    )


# --- Quantização aplicada DENTRO da apuração (HALF_UP) -----------------------
def test_apuracao_quantiza_dinheiro_half_up(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        cfop="5102",
        v_bc_ibscbs=Decimal("100.00"),
        v_ibs=Decimal("0.005"),  # 3 casas -> HALF_UP para 0.01
        v_cbs=ZERO,
        items=(),
    )
    result = _apurar_mensal([doc])
    assert result.creditos_ibs == Decimal("0.01")
    assert result.creditos == Decimal("0.01")


# --- Índice no nível de apurar(): TIE verdadeiro arredonda HALF_UP -----------
def test_apuracao_indice_tie_arredonda_half_up(
    make_document: Callable[..., FiscalDocument],
) -> None:
    """Confirma HALF_UP (não HALF_EVEN) no índice produzido por ``apurar()``.

    Montamos um documento cujo índice cai num EMPATE exato em ``.005``: crédito
    81.00 sobre base 800.00 ⇒ 81/800*100 = 10.125 EXATO (termina em dígito 5, sem
    cauda). O algarismo dos centésimos é PAR (2), então os dois modos divergem:
        HALF_UP   → 10.13 (arredonda para cima)
        HALF_EVEN → 10.12 (mantém o par)
    Asserir 10.13 distingue inequivocamente HALF_UP de HALF_EVEN no nível de
    ``apurar``, complementando ``test_compute_index_half_up`` (helper) com o tie
    propagado de ponta a ponta.
    """
    doc = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        cfop="5102",
        v_bc_ibscbs=Decimal("800.00"),
        v_ibs=Decimal("80.00"),
        v_cbs=Decimal("1.00"),
        items=(),
    )
    result = _apurar_mensal([doc])
    # Pré-condições do tie: numerador e denominador exatos em centavos.
    assert result.creditos == Decimal("81.00")
    assert result.base_entradas == Decimal("800.00")
    # 81/800*100 = 10.125 (tie exato). HALF_UP -> 10.13; HALF_EVEN daria 10.12.
    assert result.idx_credito_entradas == Decimal("10.13")
    # Corretude do modo: o tie NÃO arredonda para o par 10.12.
    assert result.idx_credito_entradas != Decimal("10.12")


# --- Invariante de EXIBIÇÃO: saldo == creditos - debitos (em centavos) -------
def test_invariante_saldo_igual_creditos_menos_debitos_em_centavos(
    make_document: Callable[..., FiscalDocument],
) -> None:
    """Documenta a relação escolhida entre saldo e (creditos - debitos).

    Com entradas em 2 casas (centavos), as somas brutas já estão em centavos e a
    quantização final é no-op; logo o saldo de EXIBIÇÃO é EXATAMENTE
    ``creditos - debitos``, e cada eixo canônico (IBS/CBS) é
    ``creditos_x - debitos_x``. Isto fixa que os agregados servem só à exibição
    (NÃO à liquidação) e não introduzem desvio de arredondamento no caso real.
    """
    entrada = make_document(
        direction=Direction.INBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(21),
        cfop="5102",
        v_bc_ibscbs=Decimal("1000.00"),
        v_ibs=Decimal("60.00"),
        v_cbs=Decimal("45.00"),
        items=(),
    )
    saida = make_document(
        direction=Direction.OUTBOUND,
        tax_regime=TaxRegime.RPA,
        access_key=synthetic_access_key(22),
        cfop="5102",
        v_bc_ibscbs=Decimal("900.00"),
        v_ibs=Decimal("40.00"),
        v_cbs=Decimal("90.00"),
        items=(),
    )
    result = _apurar_mensal([entrada, saida])
    # Agregado de exibição: saldo é exatamente creditos - debitos (em centavos).
    assert result.saldo == result.creditos - result.debitos
    # Eixos canônicos (não cruzam IBS x CBS): mesma invariante por tributo.
    assert result.saldo_ibs == result.creditos_ibs - result.debitos_ibs
    assert result.saldo_cbs == result.creditos_cbs - result.debitos_cbs
    # Coerência do agregado com os eixos (exibição = soma IBS+CBS).
    assert result.saldo == result.saldo_ibs + result.saldo_cbs


# --- Helpers internos --------------------------------------------------------


def test_compute_index_denominador_zero_e_none() -> None:
    assert _compute_index(Decimal("10"), ZERO) is None


def test_compute_index_preserva_sinal() -> None:
    assert _compute_index(Decimal("-45"), Decimal("900")) == Decimal("-5.00")


def test_compute_index_half_up() -> None:
    # 28.89 / 200 * 100 = 14.445 -> HALF_UP -> 14.45 (HALF_EVEN daria 14.44).
    assert _compute_index(Decimal("28.89"), Decimal("200")) == Decimal("14.45")


def test_quantize_money_half_up() -> None:
    assert _quantize_money(Decimal("1.005")) == Decimal("1.01")
    assert _quantize_money(Decimal("1.004")) == Decimal("1.00")
    assert _quantize_money(Decimal("-2.555")) == Decimal("-2.56")


def test_iter_assessable_units_um_por_item(
    make_document: Callable[..., FiscalDocument],
    make_item: Callable[..., FiscalItem],
) -> None:
    doc = make_document(
        items=(
            make_item(item_number=1, cfop="5102", v_bc=Decimal("10.00")),
            make_item(item_number=2, cfop="6102", v_bc=Decimal("20.00")),
        )
    )
    units = list(_iter_assessable_units(doc))
    assert [(u[0], u[1]) for u in units] == [(1, "5102"), (2, "6102")]
    assert units[1][2] == Decimal("20.00")  # v_bc do segundo item


def test_iter_assessable_units_doc_level_quando_sem_itens(
    make_document: Callable[..., FiscalDocument],
) -> None:
    doc = make_document(
        cfop="1351",
        v_bc_ibscbs=Decimal("200.00"),
        v_ibs=Decimal("10.00"),
        v_cbs=Decimal("2.00"),
        items=(),
    )
    units = list(_iter_assessable_units(doc))
    assert units == [(1, "1351", Decimal("200.00"), Decimal("10.00"), Decimal("2.00"))]
